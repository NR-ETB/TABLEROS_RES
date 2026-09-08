#!/usr/bin/env python3
"""ETL for the Responsys dashboard.

Reads the live Google Sheet (production) or a local .xlsx snapshot (development),
normalizes/join catalogs, calculates auditable quality flags, and writes a compact
JSON dataset for the React static dashboard.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import pandas as pd

SPREADSHEET_ID = os.getenv("RESPONSYS_SPREADSHEET_ID", "1widnx3vomsT6j0Z3jpfh7IASwNd-Bix_lBXgp2tdVVQ")
STAT_SHEETS = [
    "Estadisticas Campañas (2024)",
    "Estadisticas Campañas (2025)",
    "Estadisticas Campañas (2026)",
]
CAMPAIGN_SHEET = "Campañas Vigentes"
FOLDER_SHEET = "Folders Vigentes"

STAT_COLUMNS = [
    "ID", "Proposito", "Campaña", "Envios", "Soft Bounces", "Hard Bounces",
    "Unique Opens", "Unique Clicks", "Open Rate", "Click-Through Rate",
    "Unique Open Rate", "Unsubscribe Rate", "Spam Complaints Rate",
    "Launch Date", "Sent Date", "Folder", "Programa", "Año_Evento",
]


def normalize_key(value: Any) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    text = str(value).replace("\u00a0", " ").strip()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", " ", text).casefold()
    return text


def clean_text(value: Any) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\u00a0", " ").strip())


def number(value: Any) -> int:
    if value is None or value == "":
        return 0
    try:
        n = float(value)
    except (TypeError, ValueError):
        return 0
    if not math.isfinite(n):
        return 0
    return int(round(n))


def parse_date(value: Any) -> str:
    if value is None or value == "":
        return ""
    # Google Sheets API may return serial numbers; local xlsx may return Timestamps.
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            # Google/Excel serial date origin compatible for modern dates.
            ts = pd.Timestamp("1899-12-30") + pd.to_timedelta(float(value), unit="D")
            return ts.strftime("%Y-%m-%d")
        except Exception:
            return ""
    try:
        ts = pd.to_datetime(value, errors="coerce")
        if pd.isna(ts):
            return ""
        return ts.strftime("%Y-%m-%d")
    except Exception:
        return ""


def rows_to_df(values: list[list[Any]]) -> pd.DataFrame:
    if not values:
        return pd.DataFrame()
    header = [clean_text(x) for x in values[0]]
    rows = []
    width = len(header)
    for row in values[1:]:
        padded = list(row) + [None] * max(0, width - len(row))
        rows.append(padded[:width])
    return pd.DataFrame(rows, columns=header)


def read_google() -> dict[str, pd.DataFrame]:
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise RuntimeError(
            "Google libraries are missing. Install backend/requirements.txt"
        ) from exc

    credential_file = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    credential_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

    if credential_file:
        credentials = Credentials.from_service_account_file(credential_file, scopes=scopes)
    elif credential_json:
        credentials = Credentials.from_service_account_info(json.loads(credential_json), scopes=scopes)
    else:
        raise RuntimeError(
            "Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON."
        )

    service = build("sheets", "v4", credentials=credentials, cache_discovery=False)
    ranges = [f"'{s}'!A:R" for s in STAT_SHEETS] + [
        f"'{CAMPAIGN_SHEET}'!A:O",
        f"'{FOLDER_SHEET}'!A:P",
    ]
    response = (
        service.spreadsheets()
        .values()
        .batchGet(
            spreadsheetId=SPREADSHEET_ID,
            ranges=ranges,
            valueRenderOption="UNFORMATTED_VALUE",
            dateTimeRenderOption="SERIAL_NUMBER",
        )
        .execute()
    )
    value_ranges = response.get("valueRanges", [])
    if len(value_ranges) != len(ranges):
        raise RuntimeError(f"Expected {len(ranges)} ranges, received {len(value_ranges)}")

    frames: dict[str, pd.DataFrame] = {}
    for name, value_range in zip(STAT_SHEETS + [CAMPAIGN_SHEET, FOLDER_SHEET], value_ranges):
        frames[name] = rows_to_df(value_range.get("values", []))
    return frames


def read_xlsx(path: Path) -> dict[str, pd.DataFrame]:
    frames: dict[str, pd.DataFrame] = {}
    for name in STAT_SHEETS + [CAMPAIGN_SHEET, FOLDER_SHEET]:
        frames[name] = pd.read_excel(path, sheet_name=name)
    return frames


def choose_campaign_catalog(df: pd.DataFrame) -> tuple[dict[str, dict[str, Any]], set[str], int]:
    if df.empty:
        return {}, set(), 0
    work = df.copy()
    work["_key"] = work.get("Nombre", pd.Series(dtype=str)).map(normalize_key)
    work = work[work["_key"] != ""]
    duplicate_keys = int(work.groupby("_key").size().gt(1).sum())

    # Deterministic selection for duplicate names: ACTIVE first, then larger numeric ID.
    def state_rank(v: Any) -> int:
        return 1 if clean_text(v).upper() in {"ACTIVE", "A", "ACTIVO"} else 0

    work["_active_rank"] = work.get("Estado", "").map(state_rank)
    work["_id_rank"] = pd.to_numeric(work.get("ID", 0), errors="coerce").fillna(0)
    work = work.sort_values(["_key", "_active_rank", "_id_rank"], ascending=[True, False, False])
    selected = work.drop_duplicates("_key", keep="first")

    catalog: dict[str, dict[str, Any]] = {}
    for _, row in selected.iterrows():
        key = row["_key"]
        catalog[key] = {
            "name": clean_text(row.get("Nombre")),
            "folder": clean_text(row.get("Folder")),
            "type": clean_text(row.get("Tipo")),
            "status": clean_text(row.get("Estado")),
            "purpose": clean_text(row.get("Proposito")),
            "list": clean_text(row.get("Lista")),
            "subject": clean_text(row.get("Asunto")),
        }
    return catalog, set(catalog), duplicate_keys


def folder_catalog(df: pd.DataFrame) -> tuple[set[str], dict[str, str]]:
    keys: set[str] = set()
    names: dict[str, str] = {}
    if df.empty:
        return keys, names
    for _, row in df.iterrows():
        name = clean_text(row.get("Nombre"))
        key = normalize_key(name)
        if key:
            keys.add(key)
            names[key] = name
    return keys, names


def make_dataset(frames: dict[str, pd.DataFrame], source_mode: str) -> dict[str, Any]:
    campaign_catalog, campaign_keys, duplicate_campaign_keys = choose_campaign_catalog(frames[CAMPAIGN_SHEET])
    folder_keys, _ = folder_catalog(frames[FOLDER_SHEET])

    records: list[dict[str, Any]] = []
    unmatched_campaigns: dict[str, int] = {}
    unmatched_folders: dict[str, int] = {}
    source_year_mismatches = 0
    bad_rate_rows = 0
    rows_without_date = 0

    for sheet_name in STAT_SHEETS:
        sheet_year = int(re.search(r"(20\d{2})", sheet_name).group(1))
        df = frames[sheet_name].copy()
        for col in STAT_COLUMNS:
            if col not in df.columns:
                df[col] = None

        for _, row in df.iterrows():
            campaign = clean_text(row.get("Campaña"))
            # Skip truly empty grid rows, but preserve records that at least identify a campaign/date/count.
            if not campaign and not clean_text(row.get("Sent Date")) and number(row.get("Envios")) == 0:
                continue

            date = parse_date(row.get("Sent Date"))
            if not date:
                rows_without_date += 1
            actual_year = int(date[:4]) if date else 0
            if actual_year and actual_year != sheet_year:
                source_year_mismatches += 1

            campaign_key = normalize_key(campaign)
            folder = clean_text(row.get("Folder"))
            folder_key = normalize_key(folder)
            campaign_match = bool(campaign_key and campaign_key in campaign_keys)
            folder_match = bool(folder_key and folder_key in folder_keys)
            meta = campaign_catalog.get(campaign_key, {})

            if campaign and not campaign_match:
                unmatched_campaigns[campaign] = unmatched_campaigns.get(campaign, 0) + 1
            if folder and not folder_match:
                unmatched_folders[folder] = unmatched_folders.get(folder, 0) + 1

            sends = number(row.get("Envios"))
            soft = number(row.get("Soft Bounces"))
            hard = number(row.get("Hard Bounces"))
            opens = number(row.get("Unique Opens"))
            clicks = number(row.get("Unique Clicks"))
            bounces = soft + hard
            delivered = max(sends - bounces, 0)

            # Explicit source-independent rates; do not trust heterogeneous formatted rate columns.
            open_per_send = (opens / sends * 100) if sends else 0.0
            click_per_send = (clicks / sends * 100) if sends else 0.0
            bounce_per_send = (bounces / sends * 100) if sends else 0.0
            delivery_rate = (delivered / sends * 100) if sends else 0.0
            if open_per_send > 100 or click_per_send > 100 or bounce_per_send > 100:
                bad_rate_rows += 1

            records.append({
                "d": date,
                "sy": sheet_year,
                "p": clean_text(row.get("Proposito")) or meta.get("purpose", ""),
                "c": campaign,
                "f": folder,
                "g": clean_text(row.get("Programa")),
                "e": sends,
                "sb": soft,
                "hb": hard,
                "uo": opens,
                "uc": clicks,
                "t": meta.get("type", ""),
                "s": meta.get("status", ""),
                "l": meta.get("list", ""),
                "cm": 1 if campaign_match else 0,
                "fm": 1 if folder_match else 0,
            })

    dated = [r["d"] for r in records if r["d"]]
    latest_date = max(dated) if dated else ""
    earliest_date = min(dated) if dated else ""

    # Stable order improves compression and deterministic outputs.
    records.sort(key=lambda r: (r["d"] or "0000-00-00", r["c"], r["g"]))

    total_rows = len(records)
    campaign_match_rows = sum(r["cm"] for r in records if r["c"])
    campaign_named_rows = sum(1 for r in records if r["c"])
    folder_match_rows = sum(r["fm"] for r in records if r["f"])
    folder_named_rows = sum(1 for r in records if r["f"])

    def top_unmatched(mapping: dict[str, int]) -> list[dict[str, Any]]:
        return [
            {"name": k, "rows": v}
            for k, v in sorted(mapping.items(), key=lambda kv: (-kv[1], kv[0]))[:20]
        ]

    totals = {
        "sends": sum(r["e"] for r in records),
        "softBounces": sum(r["sb"] for r in records),
        "hardBounces": sum(r["hb"] for r in records),
        "uniqueOpens": sum(r["uo"] for r in records),
        "uniqueClicks": sum(r["uc"] for r in records),
    }

    # Deduplicated filter dictionaries reduce browser work.
    filters = {
        "purposes": sorted({r["p"] for r in records if r["p"]}),
        "folders": sorted({r["f"] for r in records if r["f"]}),
        "programs": sorted({r["g"] for r in records if r["g"]}),
        "campaigns": sorted({r["c"] for r in records if r["c"]}),
        "types": sorted({r["t"] for r in records if r["t"]}),
        "statuses": sorted({r["s"] for r in records if r["s"]}),
    }

    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    dataset = {
        "meta": {
            "title": "Inventario Responsys",
            "spreadsheetId": SPREADSHEET_ID,
            "sourceMode": source_mode,
            "generatedAtUtc": generated_at,
            "earliestSentDate": earliest_date,
            "latestSentDate": latest_date,
            "rowCount": total_rows,
            "formulaNotes": {
                "deliveryRate": "(Envios - Soft Bounces - Hard Bounces) / Envios",
                "openRate": "Unique Opens / Envios",
                "clickRate": "Unique Clicks / Envios",
                "bounceRate": "(Soft Bounces + Hard Bounces) / Envios",
                "temporalTruth": "Sent Date; Año_Evento y nombre de pestaña se conservan solo para control de calidad",
            },
        },
        "totals": totals,
        "quality": {
            "campaignMatchPct": round((campaign_match_rows / campaign_named_rows * 100), 3) if campaign_named_rows else 0,
            "folderMatchPct": round((folder_match_rows / folder_named_rows * 100), 3) if folder_named_rows else 0,
            "unmatchedCampaignRows": campaign_named_rows - campaign_match_rows,
            "unmatchedFolderRows": folder_named_rows - folder_match_rows,
            "sourceYearMismatchRows": source_year_mismatches,
            "rowsWithoutSentDate": rows_without_date,
            "calculatedRateOver100Rows": bad_rate_rows,
            "duplicateCampaignCatalogKeys": duplicate_campaign_keys,
            "topUnmatchedCampaigns": top_unmatched(unmatched_campaigns),
            "topUnmatchedFolders": top_unmatched(unmatched_folders),
        },
        "filters": filters,
        "records": records,
    }

    # Fingerprint excludes generatedAt so it represents data content, not build time.
    fingerprint_basis = json.dumps(
        {"records": records, "quality": dataset["quality"]},
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    dataset["meta"]["dataHash"] = hashlib.sha256(fingerprint_basis).hexdigest()[:16]
    return dataset


def write_dataset(dataset: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(dataset, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    meta_output = output.with_name("meta.json")
    meta_output.write_text(
        json.dumps({"meta": dataset["meta"], "quality": dataset["quality"]}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=["google", "xlsx"], default=os.getenv("RESPONSYS_SOURCE", "google"))
    parser.add_argument("--xlsx", type=Path, help="Local xlsx path when --source=xlsx")
    parser.add_argument("--output", type=Path, default=Path("frontend/public/data/dashboard.json"))
    args = parser.parse_args()

    if args.source == "google":
        frames = read_google()
    else:
        if not args.xlsx:
            parser.error("--xlsx is required when --source=xlsx")
        frames = read_xlsx(args.xlsx)

    dataset = make_dataset(frames, args.source)
    write_dataset(dataset, args.output)
    print(json.dumps({
        "output": str(args.output),
        "rows": dataset["meta"]["rowCount"],
        "latestSentDate": dataset["meta"]["latestSentDate"],
        "campaignMatchPct": dataset["quality"]["campaignMatchPct"],
        "folderMatchPct": dataset["quality"]["folderMatchPct"],
        "dataHash": dataset["meta"]["dataHash"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
