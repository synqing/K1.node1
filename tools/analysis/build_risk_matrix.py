#!/usr/bin/env python3
from collections import Counter
from pathlib import Path

root = Path('docs/05-analysis/git_forensics')
lines = (root / 'numstat.csv').read_text().splitlines()
churn = Counter()
for line in lines:
    parts = line.split('\t')
    if len(parts) == 3 and parts[0].isdigit():
        a, d, f = int(parts[0]), int(parts[1]), parts[2]
        churn[f] += a + d

def comp(f):
    if f.startswith('firmware/src/audio/'):
        return 'firmware.audio'
    if f.startswith('firmware/src/pattern') or f.startswith('firmware/src/generated_patterns'):
        return 'firmware.patterns'
    if f.startswith('conductor-api/'):
        return 'conductor-api'
    if f.startswith('webapp/'):
        return 'webapp'
    return 'other'

rows = []
for f, ch in churn.most_common(200):
    c = comp(f)
    crit = 2 if c in ('firmware.audio', 'firmware.patterns') else 1 if c in ('conductor-api','webapp') else 0
    risk = ch * (1 + 0.5 * crit)
    rows.append((f, c, ch, risk))

out = []
out.append('# Risk Matrix')
out.append('')
out.append('| File | Component | Churn | Risk |')
out.append('|------|-----------|------:|-----:|')
for f, c, ch, r in rows[:50]:
    out.append(f'| {f} | {c} | {ch} | {int(r)} |')

Path('docs/05-analysis/RISK_MATRIX.md').write_text('\n'.join(out))
