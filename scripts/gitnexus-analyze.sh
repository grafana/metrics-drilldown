#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
npx gitnexus analyze "$@"

# GitNexus injects a context block into AGENTS.md on every analyze.
# Strip it so AGENTS.md stays clean.
if grep -q '<!-- gitnexus:start -->' AGENTS.md 2>/dev/null; then
  sed -i '' '/<!-- gitnexus:start -->/,/<!-- gitnexus:end -->/d' AGENTS.md
fi

# GitNexus may replace the CLAUDE.md symlink with a real file. Restore it.
if [ ! -L CLAUDE.md ]; then
  rm -f CLAUDE.md
  ln -s AGENTS.md CLAUDE.md
fi
