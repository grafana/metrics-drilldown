#!/usr/bin/env bash

set -Eeuo pipefail

FULL=false
COMPOSE_STARTED_BY_SCRIPT=false
LEVITATE_OUTPUT=""
VERSION_BACKUP=""
VERSION_FILE_EXISTED=false

usage() {
  cat <<'EOF'
Run checks that commonly gate pull requests.

Usage:
  pnpm check:pr [--full]

Options:
  --full    Also run compatibility, docs, and Playwright checks.
  -h, --help
            Show this help.

The default suite runs a frozen install, lint, type checking, unit tests,
i18n extraction verification, and a production build. Full mode requires
Docker and network access. It runs Playwright once against the Grafana
version configured in .env; CI still tests its full Grafana version matrix.
EOF
}

section() {
  printf '\n\033[1;34m==> %s\033[0m\n' "$1"
}

fail() {
  printf '\nError: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' was not found. $2"
}

stop_e2e_stack() {
  if [[ "$COMPOSE_STARTED_BY_SCRIPT" == true ]]; then
    section "Stopping the E2E stack"
    pnpm run e2e:server:down || printf 'Warning: Docker Compose cleanup failed. Run pnpm e2e:server:down manually.\n' >&2
    COMPOSE_STARTED_BY_SCRIPT=false
  fi
}

cleanup() {
  local status=$?
  trap - EXIT
  stop_e2e_stack
  if [[ -n "$LEVITATE_OUTPUT" ]]; then
    rm -f "$LEVITATE_OUTPUT"
  fi
  if [[ -n "$VERSION_BACKUP" ]]; then
    if [[ "$VERSION_FILE_EXISTED" == true ]]; then
      cp "$VERSION_BACKUP" src/version.ts
    else
      rm -f src/version.ts
    fi
    rm -f "$VERSION_BACKUP"
  fi
  exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

while (($# > 0)); do
  case "$1" in
    --full)
      FULL=true
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      fail "Unknown option: $1"
      ;;
  esac
  shift
done

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

require_command node "Install the Node.js version specified by .nvmrc."
require_command pnpm "Enable Corepack or install the package manager declared in package.json."
require_command git "Install Git before running the PR checks."

required_node_major=$(node -p "Number(require('./package.json').engines.node.match(/[0-9]+/)[0])")
current_node_major=$(node -p "Number(process.versions.node.split('.')[0])")
if ((current_node_major < required_node_major)); then
  fail "Node.js ${required_node_major} or newer is required; found $(node --version)."
fi

if [[ "$FULL" == true ]]; then
  require_command docker "Install Docker or a Docker-compatible provider and start its daemon."
  require_command make "Install Make to build the documentation."
  require_command npx "Install npm with Node.js so Levitate can run."
  require_command curl "Install curl so the script can wait for Grafana."
  docker info >/dev/null 2>&1 || fail "Docker is installed, but its daemon is unavailable."
  docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required for full checks."
fi

section "Installing dependencies from the lockfile"
pnpm install --frozen-lockfile

section "Linting"
pnpm run lint

section "Type checking"
pnpm run typecheck

section "Running unit tests"
pnpm run test:ci

section "Verifying i18n extraction"
pnpm run i18n-extract-check

section "Building the plugin"
VERSION_BACKUP=$(mktemp)
if [[ -f src/version.ts ]]; then
  cp src/version.ts "$VERSION_BACKUP"
  VERSION_FILE_EXISTED=true
fi
pnpm run build

if [[ "$FULL" == true ]]; then
  section "Checking Grafana API compatibility"
  minimum_grafana_version=$(node -p "require('./src/plugin.json').dependencies.grafanaDependency.match(/[0-9]+\\.[0-9]+\\.[0-9]+/)[0]")
  levitate_targets='@grafana/data,@grafana/ui,@grafana/runtime,@grafana/schema,@grafana/e2e-selectors,@grafana/experimental'
  LEVITATE_OUTPUT=$(mktemp)

  set +e
  npx --yes @grafana/levitate@latest is-compatible \
    --path ./src/module.tsx \
    --target "$levitate_targets" \
    --min-package-version "$minimum_grafana_version" \
    --markdown | tee "$LEVITATE_OUTPUT"
  levitate_status=${PIPESTATUS[0]}
  set -e

  if grep -q "not fully compatible" "$LEVITATE_OUTPUT"; then
    fail "Levitate found possible Grafana API incompatibilities."
  fi
  if ((levitate_status != 0)); then
    fail "Levitate could not complete (exit code ${levitate_status})."
  fi

  rm -f "$LEVITATE_OUTPUT"
  LEVITATE_OUTPUT=""

  section "Building documentation"
  WEBSITE_EXEC='make prod' make -C docs docs

  section "Preparing Chromium"
  pnpm run e2e:prepare

  if [[ -n "$(docker compose ps --status running -q)" ]]; then
    printf 'An existing Docker Compose stack was detected; it will be left running.\n'
  else
    COMPOSE_STARTED_BY_SCRIPT=true
  fi

  section "Starting the E2E stack"
  pnpm run e2e:server:up

  grafana_port=$(node -e "require('dotenv').config({ quiet: true }); process.stdout.write(process.env.GRAFANA_PORT || '3001')")
  grafana_scopes_port=$(node -e "require('dotenv').config({ quiet: true }); process.stdout.write(process.env.GRAFANA_SCOPES_PORT || '3002')")

  section "Waiting for Grafana"
  ./scripts/wait-for-grafana.sh "http://localhost:${grafana_port}" 200 120 5
  ./scripts/wait-for-grafana.sh "http://localhost:${grafana_scopes_port}" 200 120 5

  section "Running Playwright against the configured Grafana version"
  pnpm exec playwright test --config e2e/config/playwright.config.ci.ts

  stop_e2e_stack
fi

section "Local PR checks passed"
if [[ "$FULL" == true ]]; then
  printf 'Fast and full local checks completed successfully.\n'
else
  printf 'Fast checks completed successfully. Run pnpm check:pr --full for compatibility, docs, and E2E checks.\n'
fi
printf 'CI will still run hosted checks, security scans, bundle comparison, and the Grafana E2E version matrix.\n'
