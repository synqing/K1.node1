#!/usr/bin/env bash
# Git sync helper: add/set origin, stash WIP, rebase main, push.
# Usage:
#   ./tools/git_sync.sh git@github.com:ORG/REPO.git
#   OR export ORIGIN_URL=git@github.com:ORG/REPO.git && ./tools/git_sync.sh

set -euo pipefail

ORIGIN_URL="${1:-${ORIGIN_URL:-}}"
if [[ -z "${ORIGIN_URL}" ]]; then
  echo "error: provide remote URL as arg or ORIGIN_URL env var" >&2
  exit 2
fi

# Ensure we are in repo root
if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "error: not inside a git repository" >&2
  exit 2
fi

ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

# Add or update origin
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$ORIGIN_URL"
else
  git remote add origin "$ORIGIN_URL"
fi

# Make a safety backup branch
CURR_BRANCH=$(git rev-parse --abbrev-ref HEAD)
STAMP=$(date +%F_%H%M%S)
git branch "backup/pre-sync-${STAMP}" || true

# Stash WIP if any
if ! git diff --quiet || ! git diff --cached --quiet; then
  git stash -u -m "git-sync-wip-${STAMP}" || true
  STASHED=1
else
  STASHED=0
fi

# Ensure we’re on main (create it if detached)
if [[ "$CURR_BRANCH" == "HEAD" ]]; then
  git checkout -B main
fi

# Fetch + set upstream + rebase
git fetch origin
git branch --set-upstream-to=origin/main main || true
git pull --rebase origin main

# Restore stash if we had one
if [[ "$STASHED" == "1" ]]; then
  set +e
  git stash pop
  POP_RC=$?
  set -e
  if [[ $POP_RC -ne 0 ]];n then
    echo "note: stash pop reported conflicts. Resolve, then run: git add <files> && git commit -m 'Apply stashed changes post-rebase'" >&2
  fi
fi

# Push main
git push -u origin main

echo "Sync complete: origin=$(git remote get-url origin) branch=main"

