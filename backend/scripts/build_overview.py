"""Build the small, versioned landing payload from the dashboard snapshot."""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path


def period_dates(meta, period):
    last = date.fromisoformat(meta['latestSentDate'])
    first = date.fromisoformat(meta['earliestSentDate'])
    if period == 'last30':
        first = max(first, last - timedelta(days=29))
    elif period == 'last90':
        first = max(first, last - timedelta(days=89))
    elif period == 'latestYear':
        first = max(first, date(last.year, 1, 1))
    return first.isoformat(), last.isoformat()


def totals(rows):
    counts = {name: sum(r[key] for r in rows) for name, key in
              [('sends', 'e'), ('opens', 'uo'), ('clicks', 'uc'), ('soft', 'sb'), ('hard', 'hb')]}
    counts.update(rows=len(rows), bounces=counts['soft'] + counts['hard'])
    counts['delivered'] = max(counts['sends'] - counts['bounces'], 0)
    return counts


def issues(row):
    return {
        'missingCampaign': not row['c'],
        'unmatchedCampaign': not row['cm'],
        'unmatchedFolder': not row['fm'],
        'zeroSendActivity': row['e'] == 0 and any(row[k] > 0 for k in ['sb', 'hb', 'uo', 'uc']),
        'rateOver100': row['e'] > 0 and max(row['uo'], row['uc'], row['sb'] + row['hb']) > row['e'],
        'dateMismatch': bool(row['d']) and int(row['d'][:4]) != row['sy'],
        'withoutDate': not row['d'],
    }


def quality(rows):
    result = {key: 0 for key in issues({'c': '', 'cm': 0, 'fm': 0, 'e': 0, 'sb': 0, 'hb': 0, 'uo': 0, 'uc': 0, 'd': '', 'sy': 0})}
    result.update(fullMatch=0, anomalyRows=0)
    for row in rows:
        flags = issues(row)
        for key, value in flags.items():
            result[key] += int(value)
        result['fullMatch'] += int(bool(row['cm'] and row['fm']))
        result['anomalyRows'] += int(any(flags.values()))
    return result


def groups(rows, key, limit, other=False):
    counts = defaultdict(int)
    for row in rows:
        counts[row[key] or 'Sin dato'] += row['e']
    ordered = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    items = [{'label': name, 'value': value, 'other': False} for name, value in ordered[:limit]]
    if other and len(ordered) > limit:
        items.append({'label': 'Otros', 'value': sum(value for _, value in ordered[limit:]), 'other': True})
    return items


def coverage(rows, start, end):
    return {'daysWithRecords': len({r['d'] for r in rows if r['d']}),
            'calendarDays': (date.fromisoformat(end) - date.fromisoformat(start)).days + 1}


def summarize(records, start, end, period):
    rows = [r for r in records if r['d'] and start <= r['d'] <= end]
    monthly = (date.fromisoformat(end) - date.fromisoformat(start)).days > 120
    buckets = defaultdict(list)
    for row in rows:
        buckets[row['d'][:7] if monthly else row['d']].append(row)
    cursor = date.fromisoformat(start)
    finish = date.fromisoformat(end)
    trend = []
    while cursor <= finish:
        label = cursor.isoformat()[:7] if monthly else cursor.isoformat()
        bucket = buckets.get(label)
        counts = totals(bucket) if bucket else None
        trend.append({'label': label, 'value': counts['sends'] if counts else None,
                      **{key: counts[key] if counts else None for key in ['opens', 'clicks', 'bounces', 'rows']}})
        if monthly:
            cursor = date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)
        else:
            cursor += timedelta(days=1)
    comparison = None
    if period != 'all':
        previous_end = date.fromisoformat(start) - timedelta(days=1)
        previous_start = previous_end - timedelta(days=(finish - date.fromisoformat(start)).days)
        previous_rows = [r for r in records if r['d'] and previous_start.isoformat() <= r['d'] <= previous_end.isoformat()]
        comparison = {'from': previous_start.isoformat(), 'to': previous_end.isoformat(),
                      'totals': totals(previous_rows),
                      'coverage': coverage(previous_rows, previous_start.isoformat(), previous_end.isoformat())}
    return {'from': start, 'to': end, 'totals': totals(rows), 'coverage': coverage(rows, start, end),
            'comparison': comparison, 'trend': trend,
            'topCampaigns': groups(rows, 'c', 5), 'folders': groups(rows, 'f', 3, True),
            'purposes': groups(rows, 'p', 3, True), 'quality': quality(rows)}


def build_overview(dataset):
    meta = dataset['meta']
    if not meta['earliestSentDate'] or not meta['latestSentDate']:
        raise ValueError('No dated records: cannot publish an empty dashboard')
    return {'schemaVersion': 2, 'meta': meta, 'filters': dataset['filters'],
            'sourceQuality': dataset['quality'],
            'summaries': {period: summarize(dataset['records'], *period_dates(meta, period), period)
                          for period in ['all', 'last30', 'last90', 'latestYear']}}


def write_overview(dataset, output):
    encoded = json.dumps(build_overview(dataset), ensure_ascii=False, separators=(',', ':'))
    if len(encoded.encode('utf-8')) >= 50_000:
        raise ValueError('overview.json exceeds the 50 KB initial payload budget')
    temporary = output.with_suffix('.json.tmp')
    temporary.write_text(encoded, encoding='utf-8')
    temporary.replace(output)
    return len(encoded.encode('utf-8'))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('dataset', nargs='?', type=Path, default=Path('frontend/public/data/dashboard.json'))
    args = parser.parse_args()
    dataset = json.loads(args.dataset.read_text(encoding='utf-8'))
    size = write_overview(dataset, args.dataset.with_name('overview.json'))
    print(json.dumps({'overviewBytes': size, 'dataHash': dataset['meta']['dataHash']}))
