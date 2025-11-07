#!/usr/bin/env bash
# Configure Git to keep "ours" for specific hot files via a custom merge driver.
# Also enables rerere to remember future conflict resolutions.
# Usage: bash tools/git_setup_merge_drivers.sh

set -euo pipefail

git config merge.keepours.name "Keep ours during merges"
git config merge.keepours.driver true

git config rerere.enabled true

echo "Configured merge.keepours driver and enabled rerere."
echo "Attributes in .gitattributes:"
grep -n "keepours" .gitattributes || true

