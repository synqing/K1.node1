#!/usr/bin/env bash
set -euo pipefail
out="docs/05-analysis/git_forensics"
mkdir -p "$out"
git log --date=iso --pretty=format:'%h,%ad,%an,%ae,%s' > "$out/commits.csv"
git log --date=iso --numstat --format='%h,%ad' > "$out/numstat.csv"
git shortlog -sne > "$out/shortlog.txt"
git log --date=iso --name-status --pretty=format:'%h,%ad' > "$out/name-status.txt"
