#!/usr/bin/env python3
from collections import defaultdict, Counter
from datetime import datetime
from pathlib import Path

root = Path('docs/05-analysis/git_forensics')
commit_lines = (root / 'commits.csv').read_text().splitlines()
numstat_lines = list((root / 'numstat.csv').read_text().splitlines())

weeks = defaultdict(lambda: {'commits': 0, 'adds': 0, 'dels': 0})
authors_week = defaultdict(lambda: Counter())
files_churn = Counter()

for line in commit_lines:
    parts = line.split(',', 4)
    if len(parts) < 5:
        continue
    h, ad, an, ae, s = parts
    dt = datetime.fromisoformat(ad.replace(' +0800', '').replace(' +0000', ''))
    wk = dt.strftime('%Y-%W')
    weeks[wk]['commits'] += 1
    authors_week[wk][an] += 1

cur_week = None
for line in numstat_lines:
    if ',' in line and line.count(',') == 1:
        ad = line.split(',')[1]
        dt = datetime.fromisoformat(ad.replace(' +0800', '').replace(' +0000', ''))
        cur_week = dt.strftime('%Y-%W')
        continue
    parts = line.split('\t')
    if len(parts) == 3 and parts[0].isdigit():
        a, d, f = int(parts[0]), int(parts[1]), parts[2]
        files_churn[f] += a + d
        if cur_week:
            weeks[cur_week]['adds'] += a
            weeks[cur_week]['dels'] += d

out_md = []
out_md.append('# Project Health Timeline')
out_md.append('')
out_md.append('| Week | Commits | Adds | Dels | Top Author Share |')
out_md.append('|------|---------:|-----:|-----:|------------------:|')
for wk in sorted(weeks.keys()):
    c = weeks[wk]['commits']
    a = weeks[wk]['adds']
    d = weeks[wk]['dels']
    top_share = 0
    if authors_week[wk]:
        top = authors_week[wk].most_common(1)[0][1]
        top_share = round((top / c) * 100, 1) if c else 0
    out_md.append(f'| {wk} | {c} | {a} | {d} | {top_share}% |')

out_md.append('')
out_md.append('## Hotspot Files (Top 30 by churn)')
out_md.append('')
out_md.append('| File | Churn |')
out_md.append('|------|------:|')
for f, ch in files_churn.most_common(30):
    out_md.append(f'| {f} | {ch} |')

Path(root / 'metrics_summary.md').write_text('\n'.join(out_md))
