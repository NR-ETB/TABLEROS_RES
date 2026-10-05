import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend/scripts'))
from build_overview import build_overview, period_dates, summarize
from validate_dataset import validate, validate_files


class OverviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset = json.loads((ROOT / 'frontend/public/data/dashboard.json').read_text(encoding='utf-8'))

    def test_snapshot_contract_and_budget(self):
        self.assertTrue(validate_files(ROOT / 'frontend/public/data/dashboard.json')['ok'])
        result = build_overview(self.dataset)
        self.assertEqual(result['summaries']['all']['totals']['sends'], self.dataset['totals']['sends'])
        self.assertEqual(result['summaries']['all']['comparison'], None)

    def test_equal_duration_and_inclusive_boundaries(self):
        row = dict(self.dataset['records'][0], e=10, sb=0, hb=0, uo=2, uc=1)
        rows = [dict(row, d=d) for d in ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02', '2026-03-03']]
        result = summarize(rows, '2026-03-01', '2026-03-02', 'custom')
        self.assertEqual(result['totals']['sends'], 20)
        self.assertEqual(result['comparison']['from'], '2026-02-27')
        self.assertEqual(result['comparison']['to'], '2026-02-28')
        self.assertEqual(result['comparison']['totals']['sends'], 20)

    def test_unknown_dates_and_zero_activity_are_preserved(self):
        row = dict(self.dataset['records'][0], d='', e=0, uo=8, sb=0, hb=0)
        summary = summarize([row], '2026-01-01', '2026-01-02', 'custom')
        self.assertEqual(summary['totals']['rows'], 0)
        self.assertEqual(summary['trend'][0]['value'], None)
        self.assertEqual(summary['comparison']['totals']['sends'], 0)

    def test_preset_anchors_dataset_not_clock(self):
        meta = {'earliestSentDate': '2024-01-01', 'latestSentDate': '2026-03-01'}
        self.assertEqual(period_dates(meta, 'last30'), ('2026-01-31', '2026-03-01'))
        self.assertEqual(period_dates(meta, 'latestYear'), ('2026-01-01', '2026-03-01'))

    def test_corrupt_count_hash_and_extent_fail(self):
        for key, value in [('rowCount', 0), ('dataHash', 'wrong'), ('latestSentDate', '2020-01-01')]:
            data = copy.deepcopy(self.dataset)
            data['meta'][key] = value
            with self.assertRaises(ValueError): validate(data)


if __name__ == '__main__':
    unittest.main()
