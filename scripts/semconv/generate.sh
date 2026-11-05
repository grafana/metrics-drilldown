#!/usr/bin/env bash
# Generates src/shared/otel/semconv/semconv.generated.json from a pinned OpenTelemetry
# semantic conventions release, using OTel Weaver.
#
# Usage:
#   pnpm generate:semconv          Regenerate the checked-in JSON.
#   pnpm generate:semconv:check    Regenerate to a temp file and fail if it differs from the checked-in JSON.
#
# Weaver runs from, in order: $WEAVER_BIN (must match WEAVER_VERSION), then the otel/weaver Docker image.

set -Eeuo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$ROOT_DIR"

TARGET=src/shared/otel/semconv/semconv.generated.json
CHECK=false

while (($# > 0)); do
  case "$1" in
    --check)
      CHECK=true
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      exit 2
      ;;
  esac
  shift
done

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

set -a
# shellcheck source=scripts/semconv/versions.env
source scripts/semconv/versions.env
set +a

[[ -n "${SEMCONV_VERSION:-}" && -n "${WEAVER_VERSION:-}" ]] || fail "scripts/semconv/versions.env must set SEMCONV_VERSION and WEAVER_VERSION."

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT
mkdir "$WORK_DIR/out"

# The git tag form must be url@tag[subfolder]. The reverse order fails with a misleading IO error.
REGISTRY="https://github.com/open-telemetry/semantic-conventions.git@${SEMCONV_VERSION}[model]"

if [[ -n "${WEAVER_BIN:-}" ]]; then
  actual_version=$("$WEAVER_BIN" --version | awk '{print $2}')
  [[ "v${actual_version}" == "$WEAVER_VERSION" ]] || fail "WEAVER_BIN is ${actual_version} but versions.env pins ${WEAVER_VERSION}."
  weaver_cmd=("$WEAVER_BIN" registry generate -r "$REGISTRY" --v2 -t "$ROOT_DIR/scripts/semconv/templates" lookup "$WORK_DIR/out")
else
  command -v docker >/dev/null 2>&1 || fail "Docker is required to run Weaver (or set WEAVER_BIN to a Weaver ${WEAVER_VERSION} binary)."
  weaver_cmd=(
    docker run --rm
    --user "$(id -u):$(id -g)"
    -e HOME=/tmp
    -v "$ROOT_DIR/scripts/semconv/templates:/templates:ro"
    -v "$WORK_DIR/out:/out"
    "otel/weaver:${WEAVER_VERSION}"
    registry generate -r "$REGISTRY" --v2 -t /templates lookup /out
  )
fi

printf 'Running Weaver %s against semantic conventions %s\n' "$WEAVER_VERSION" "$SEMCONV_VERSION"
# Weaver prints absolute paths and format warnings to stderr, so it goes to a log. Trust the exit code, never the output file alone.
if ! "${weaver_cmd[@]}" >"$WORK_DIR/weaver.log" 2>&1; then
  cat "$WORK_DIR/weaver.log" >&2
  fail "Weaver failed."
fi

if [[ "$CHECK" == true ]]; then
  node scripts/semconv/build-lookup.mjs "$WORK_DIR/out/lookup.json" "$WORK_DIR/check.json"
  if ! diff -u "$TARGET" "$WORK_DIR/check.json"; then
    fail "$TARGET is out of date. Run 'pnpm generate:semconv' and commit the result."
  fi
  printf '%s is up to date.\n' "$TARGET"
else
  node scripts/semconv/build-lookup.mjs "$WORK_DIR/out/lookup.json" "$TARGET"
fi
