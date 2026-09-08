#!/usr/bin/env python3
from pathlib import Path
import argparse, json

p=argparse.ArgumentParser()
p.add_argument('dataset', nargs='?', default='frontend/public/data/dashboard.json')
a=p.parse_args()
d=json.loads(Path(a.dataset).read_text(encoding='utf-8'))
records=d['records']
assert len(records)==d['meta']['rowCount']
assert d['meta']['latestSentDate'] == max((r['d'] for r in records if r['d']), default='')
assert all(k in d['quality'] for k in ['campaignMatchPct','folderMatchPct','sourceYearMismatchRows'])
print(json.dumps({
 'ok': True,
 'rows': len(records),
 'latestSentDate': d['meta']['latestSentDate'],
 'dataHash': d['meta']['dataHash'],
 'campaignMatchPct': d['quality']['campaignMatchPct'],
 'folderMatchPct': d['quality']['folderMatchPct'],
}, ensure_ascii=False, indent=2))
