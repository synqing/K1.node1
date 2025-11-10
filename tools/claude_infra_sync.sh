#!/usr/bin/env bash
set -euo pipefail

# Sync the managed .claude infrastructure from the central repo.
# Usage:
#  ./tools/claude_infra_sync.sh
# Optional env:
#  CENTRAL_PATH=/Users/spectrasynq/Workspace_Management/Software/claude-infra

CENTRAL_PATH_DEFAULT="/Users/spectrasynq/Workspace_Management/Software/claude-infra"
CENTRAL_PATH="${CENTRAL_PATH:-$CENTRAL_PATH_DEFAULT}"

echo "[claude-sync] Central path: $CENTRAL_PATH"
if [ ! -d "$CENTRAL_PATH/.claude" ]; then
  echo "[claude-sync] ERROR: $CENTRAL_PATH/.claude not found. Ensure central repo exists and is cloned."
  exit 1
fi

TMP_DIR=".claude_sync_tmp"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

echo "[claude-sync] Copying central .claude to tmp..."
rsync -a --delete "$CENTRAL_PATH/.claude/" "$TMP_DIR/.claude/"

echo "[claude-sync] Preserving local settings.local.json if present..."
if [ -f ".claude/settings.local.json" ]; then
  cp ".claude/settings.local.json" "$TMP_DIR/.claude/settings.local.json"
fi

echo "[claude-sync] Replacing project .claude with synced contents..."
rm -rf ".claude"
mv "$TMP_DIR/.claude" ".claude"
rm -rf "$TMP_DIR"

echo "[claude-sync] Done. Review changes, then commit as needed."

