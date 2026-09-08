from pathlib import Path
import importlib.util

MODULE = Path(__file__).resolve().parents[1] / "scripts" / "sync_responsys.py"
spec = importlib.util.spec_from_file_location("sync_responsys", MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def test_normalize_key():
    assert mod.normalize_key("  Campaña\u00a0UNO  ") == "campana uno"


def test_number():
    assert mod.number(None) == 0
    assert mod.number("12") == 12


def test_date():
    assert mod.parse_date("2026-09-08") == "2026-09-08"
