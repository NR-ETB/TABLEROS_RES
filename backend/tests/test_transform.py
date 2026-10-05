from pathlib import Path
import importlib.util
import sys
import tempfile
import unittest
import pandas as pd

MODULE = Path(__file__).resolve().parents[1] / "scripts" / "sync_responsys.py"
spec = importlib.util.spec_from_file_location("sync_responsys", MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
sys.path.insert(0, str(MODULE.parent))


def test_normalize_key():
    assert mod.normalize_key("  Campaña\u00a0UNO  ") == "campana uno"


def test_number():
    assert mod.number(None) == 0
    assert mod.number("12") == 12


def test_date():
    assert mod.parse_date("2026-09-08") == "2026-09-08"


class TransformTests(unittest.TestCase):
    def test_legacy_normalization_counts_and_dates(self):
        test_normalize_key()
        test_number()
        test_date()
        self.assertEqual(mod.parse_date(45292), '2024-01-01')

    def test_minimal_catalog_does_not_require_optional_columns(self):
        catalog, keys, duplicates = mod.choose_campaign_catalog(pd.DataFrame([{'Nombre': 'Campaña'}]))
        self.assertIn('campana', keys)
        self.assertEqual(duplicates, 0)
        self.assertEqual(catalog['campana']['status'], '')

    def test_source_duplicates_and_undated_activity_are_kept(self):
        row = {column: '' for column in mod.STAT_COLUMNS}
        row.update({'Campaña': 'Campaña', 'Sent Date': '2024-01-01', 'Envios': 10})
        activity = dict(row, **{'Campaña': '', 'Sent Date': '', 'Envios': 0, 'Unique Opens': 8})
        frames = {name: pd.DataFrame(columns=mod.STAT_COLUMNS) for name in mod.STAT_SHEETS}
        frames[mod.STAT_SHEETS[0]] = pd.DataFrame([row, row, activity])
        frames[mod.CAMPAIGN_SHEET] = pd.DataFrame([{'Nombre': 'Campaña'}])
        frames[mod.FOLDER_SHEET] = pd.DataFrame(columns=['Nombre'])
        dataset = mod.make_dataset(frames, 'xlsx')
        self.assertEqual(dataset['meta']['rowCount'], 3)
        self.assertEqual(dataset['totals']['sends'], 20)
        self.assertEqual(dataset['totals']['uniqueOpens'], 8)
        self.assertEqual(dataset['quality']['rowsWithoutSentDate'], 1)
        with tempfile.TemporaryDirectory(prefix='test-etl-', dir=MODULE.parents[2]) as directory:
            output = Path(directory) / 'dashboard.json'
            mod.write_dataset(dataset, output)
            self.assertTrue(output.with_name('overview.json').exists())
            from validate_dataset import validate_files
            self.assertTrue(validate_files(output)['ok'])

    def test_missing_required_headers_fail_before_zeroing_counts(self):
        frames = {name: pd.DataFrame([{'Campaña': 'Campaña'}]) for name in mod.STAT_SHEETS}
        frames[mod.CAMPAIGN_SHEET] = pd.DataFrame([{'Nombre': 'Campaña'}])
        frames[mod.FOLDER_SHEET] = pd.DataFrame(columns=['Nombre'])
        with self.assertRaisesRegex(ValueError, 'missing columns'):
            mod.make_dataset(frames, 'xlsx')
