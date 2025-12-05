#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
from collections import defaultdict, Counter
import matplotlib.pyplot as plt
import pandas as pd

root = Path('docs/05-analysis/git_forensics')
png_dir = root / 'png'
png_dir.mkdir(parents=True, exist_ok=True)
commit_lines = (root / 'commits.csv').read_text().splitlines()
numstat_lines = (root / 'numstat.csv').read_text().splitlines()
shortlog = (root / 'shortlog.txt').read_text().splitlines()

weeks = defaultdict(lambda: {'commits': 0, 'adds': 0, 'dels': 0})
authors_week = defaultdict(lambda: Counter())
files_churn = Counter()

for line in commit_lines:
    parts = line.split(',', 4)
    if len(parts) < 5:
        continue
    h, ad, an, ae, s = parts
    try:
        dt = datetime.fromisoformat(ad.replace(' +0800', '').replace(' +0000', ''))
    except ValueError:
        continue
    wk = dt.strftime('%Y-%W')
    weeks[wk]['commits'] += 1
    authors_week[wk][an] += 1

cur_week = None
for line in numstat_lines:
    if ',' in line and line.count(',') == 1:
        ad = line.split(',')[1]
        try:
            dt = datetime.fromisoformat(ad.replace(' +0800', '').replace(' +0000', ''))
        except ValueError:
            cur_week = None
            continue
        cur_week = dt.strftime('%Y-%W')
        continue
    parts = line.split('\t')
    if len(parts) == 3 and parts[0].isdigit():
        a, d, f = int(parts[0]), int(parts[1]), parts[2]
        files_churn[f] += a + d
        if cur_week:
            weeks[cur_week]['adds'] += a
            weeks[cur_week]['dels'] += d

author_counts = []
for l in shortlog:
    l = l.strip()
    if not l:
        continue
    if l[0].isdigit():
        parts = l.split('\t') if '\t' in l else l.split()
        try:
            cnt = int(parts[0])
            name = ' '.join(parts[1:])
            author_counts.append((name, cnt))
        except Exception:
            continue

wk_sorted = sorted(weeks.keys())
df = pd.DataFrame({
    'week': wk_sorted,
    'commits': [weeks[w]['commits'] for w in wk_sorted],
    'adds': [weeks[w]['adds'] for w in wk_sorted],
    'dels': [weeks[w]['dels'] for w in wk_sorted]
})
plt.figure(figsize=(10,4))
plt.bar(df['week'], df['commits'], color='#4e79a7')
plt.xticks(rotation=60, ha='right')
plt.tight_layout()
plt.savefig(png_dir / 'timeline_commits_per_week.png')
plt.close()

plt.figure(figsize=(10,4))
plt.bar(df['week'], df['adds'], label='adds', color='#59a14f')
plt.bar(df['week'], df['dels'], bottom=df['adds'], label='dels', color='#e15759')
plt.legend()
plt.xticks(rotation=60, ha='right')
plt.tight_layout()
plt.savefig(png_dir / 'timeline_adds_dels_per_week.png')
plt.close()

top_files = files_churn.most_common(30)
tf_df = pd.DataFrame(top_files, columns=['file','churn'])
plt.figure(figsize=(10,8))
plt.barh(tf_df['file'], tf_df['churn'], color='#edc948')
plt.gca().invert_yaxis()
plt.tight_layout()
plt.savefig(png_dir / 'hotspots_top30_churn.png')
plt.close()

ac_sorted = sorted(author_counts, key=lambda x: x[1], reverse=True)[:10]
ac_df = pd.DataFrame(ac_sorted, columns=['author','commits'])
plt.figure(figsize=(8,5))
plt.barh(ac_df['author'], ac_df['commits'], color='#76b7b2')
plt.gca().invert_yaxis()
plt.tight_layout()
plt.savefig(png_dir / 'authors_top10_commits.png')
plt.close()

top_share = []
for w in wk_sorted:
    counts = authors_week[w]
    if not counts:
        top_share.append(0)
    else:
        top = counts.most_common(1)[0][1]
        c = weeks[w]['commits'] or 1
        top_share.append(round((top/c)*100,1))
plt.figure(figsize=(10,4))
plt.plot(df['week'], top_share, color='#f28e2b', marker='o')
plt.xticks(rotation=60, ha='right')
plt.tight_layout()
plt.savefig(png_dir / 'bus_factor_top_author_share.png')
plt.close()
