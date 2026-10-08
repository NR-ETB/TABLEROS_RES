"""Reject broken contracts before deployment; retain and report source anomalies."""
from pathlib import Path
from datetime import date
import argparse
import hashlib
import json
from build_overview import build_overview


def validate(dataset):
    rows = dataset['records']
    meta = dataset['meta']
    if not rows or len(rows) != meta['rowCount']:
        raise ValueError('Record count is empty or differs from metadata')
    required = {'d', 'sy', 'p', 'c', 'f', 'g', 'e', 'sb', 'hb', 'uo', 'uc', 't', 's', 'l', 'cm', 'fm'}
    for index, row in enumerate(rows):
        if not required <= row.keys():
            raise ValueError(f'Missing record fields at row {index}')
        if row['d'] and date.fromisoformat(row['d']).isoformat() != row['d']:
            raise ValueError(f'Invalid date at row {index}')
        for key in ['e', 'sb', 'hb', 'uo', 'uc', 'sy']:
            if type(row[key]) is not int or row[key] < 0:
                raise ValueError(f'Invalid count {key} at row {index}')
        if row['cm'] not in (0, 1) or row['fm'] not in (0, 1):
            raise ValueError(f'Invalid join flag at row {index}')
    dates = [r['d'] for r in rows if r['d']]
    if not dates or meta['earliestSentDate'] != min(dates) or meta['latestSentDate'] != max(dates):
        raise ValueError('Date extent differs from metadata')
    for name, key in [('sends', 'e'), ('softBounces', 'sb'), ('hardBounces', 'hb'), ('uniqueOpens', 'uo'), ('uniqueClicks', 'uc')]:
        if dataset['totals'][name] != sum(row[key] for row in rows):
            raise ValueError(f'Total mismatch: {name}')
    content = {'records': rows, 'quality': dataset['quality']}
    if 'catalog' in dataset:
        content['catalog'] = dataset['catalog']
        for entry in dataset['catalog']:
            if not isinstance(entry.get('fields'), dict) or not entry['fields'].get('Nombre'):
                raise ValueError('Invalid campaign catalog entry')
    basis = json.dumps(content, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode('utf-8')
    if hashlib.sha256(basis).hexdigest()[:16] != meta['dataHash']:
        raise ValueError('Data fingerprint mismatch')


def validate_files(path):
    dataset = json.loads(path.read_text(encoding='utf-8'))
    validate(dataset)
    overview_path = path.with_name('overview.json')
    if overview_path.stat().st_size >= 50_000:
        raise ValueError('Overview exceeds 50 KB')
    overview = json.loads(overview_path.read_text(encoding='utf-8'))
    if overview != build_overview(dataset):
        raise ValueError('Overview does not match the detail contract')
    return {'ok': True, 'rows': len(dataset['records']), 'latestSentDate': dataset['meta']['latestSentDate'],
            'dataHash': dataset['meta']['dataHash'], 'overviewBytes': overview_path.stat().st_size}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('dataset', nargs='?', type=Path, default=Path('frontend/public/data/dashboard.json'))
    args = parser.parse_args()
    print(json.dumps(validate_files(args.dataset), ensure_ascii=False, indent=2))
