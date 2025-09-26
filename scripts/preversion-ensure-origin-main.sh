#!/bin/bash

# Bash strict mode
# https://gist.github.com/mohanpedala/1e2ff5661761d3abd0385e8223e16425
set -euo pipefail

# Always compare against 'origin/main'
TARGET_BRANCH="main"

if ! git ls-remote --exit-code --heads origin "$TARGET_BRANCH" >/dev/null 2>&1; then
  echo -e "\n❌ Error: Remote branch 'origin/$TARGET_BRANCH' not found."
  echo -e "   Ensure your remote has a 'main' branch pushed."
  exit 1
fi

echo -e "\n🔍 Fetching latest from 'origin/$TARGET_BRANCH'..."
git fetch origin "$TARGET_BRANCH" --quiet

if git merge-base --is-ancestor "origin/$TARGET_BRANCH" HEAD; then
  echo -e "\n✅ HEAD already contains the latest 'origin/$TARGET_BRANCH'. Proceeding..."
else
  BEHIND_COUNT=$(git rev-list --left-only --count "HEAD...origin/$TARGET_BRANCH")
  echo -e "\n❌ Your branch is behind 'origin/$TARGET_BRANCH' by $BEHIND_COUNT commit(s)."
  echo -e "   Please update your branch, for example:"
  echo -e "     git fetch origin $TARGET_BRANCH"
  echo -e "     git rebase origin/$TARGET_BRANCH   # or: git merge origin/$TARGET_BRANCH"
  echo -e "\n   Then re-run your 'npm version' command."
  exit 1
fi


