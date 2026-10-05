import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  change,
  csv,
  defaultFilters,
  filterRows,
  flags,
  periodDates,
  query,
  summarize,
  totals,
  validateDetail,
} from "../src/lib/analysis.ts";
import { makeHash, readHash } from "../src/lib/navigation.ts";
import type {
  DashboardData,
  OverviewData,
  Period,
  Query,
  RecordRow,
} from "../src/types.ts";
const dataset: DashboardData = JSON.parse(
  readFileSync(
    new URL("../public/data/dashboard.json", import.meta.url),
    "utf8",
  ),
);
const overview: OverviewData = JSON.parse(
  readFileSync(
    new URL("../public/data/overview.json", import.meta.url),
    "utf8",
  ),
);
const defaults = defaultFilters(dataset.meta);
const base: Query = {
  filters: defaults,
  page: 1,
  sort: "sends",
  ascending: false,
  selected: null,
  recordPage: 1,
  issue: "all",
};
const row: RecordRow = {
  ...dataset.records[0],
  e: 10,
  uo: 2,
  uc: 1,
  sb: 0,
  hb: 0,
  cm: 1,
  fm: 1,
  c: "Original",
};
test("Python overview and TypeScript engine agree for all four presets on the full snapshot", () => {
  for (const period of ["all", "last30", "last90", "latestYear"] as Exclude<
    Period,
    "custom"
  >[]) {
    const [from, to] = periodDates(dataset.meta, period);
    assert.deepEqual(
      summarize(dataset.records, { ...defaults, period, from, to }),
      overview.summaries[period],
    );
  }
  const total = totals(dataset.records);
  assert.equal(total.sends, dataset.totals.sends);
  assert.equal(total.opens, dataset.totals.uniqueOpens);
  assert.equal(total.clicks, dataset.totals.uniqueClicks);
  assert.equal(
    total.bounces,
    dataset.totals.softBounces + dataset.totals.hardBounces,
  );
  assert.equal(total.delivered, Math.max(total.sends - total.bounces, 0));
});
test("Inclusive boundaries, adjacent equal-duration comparison and real missing intervals", () => {
  const rows = [
    "2026-02-27",
    "2026-02-28",
    "2026-03-01",
    "2026-03-02",
    "2026-03-04",
  ].map((d) => ({ ...row, d }));
  const summary = summarize(rows, {
    ...defaults,
    period: "custom",
    from: "2026-03-01",
    to: "2026-03-02",
  });
  assert.equal(summary.totals.sends, 20);
  assert.equal(summary.comparison?.from, "2026-02-27");
  assert.equal(summary.comparison?.to, "2026-02-28");
  assert.equal(summary.comparison?.totals.sends, 20);
  assert.equal(
    summarize(rows, {
      ...defaults,
      period: "custom",
      from: "2026-03-01",
      to: "2026-03-04",
    }).trend[2].value,
    null,
  );
  assert.equal(summarize([], defaults).totals.sends, 0);
  assert.equal(change(2, 0), "No comparable");
  assert.equal(change(20, 10), "+100% vs. anterior");
  assert.equal(change(20, 10, true), "+10 pp vs. anterior");
});
test("Unknown dates excluded from date ranges; reachable through quality; anomalies retained", () => {
  const unknown = { ...row, d: "", e: 0, uo: 8 };
  assert.deepEqual(filterRows([unknown], defaults), []);
  assert.equal(
    filterRows([unknown], { ...defaults, quality: "withoutDate" }).length,
    1,
  );
  assert.equal(flags(unknown).zeroSendActivity, true);
  assert.equal(totals([unknown]).opens, 8);
  assert.equal(flags({ ...row, uc: 11 }).rateOver100, true);
});
test("Exact campaign drilldown, filtered totals, pages and exports use identical records", () => {
  const records = Array.from({ length: 60 }, (_, i) => ({
    ...row,
    d: "2026-01-01",
    c: i < 55 ? "Original" : "Original extra",
  }));
  const filters = { ...defaults, campaignExact: "Original" };
  const result = query(records, {
    ...base,
    filters,
    selected: "Original",
    recordPage: 2,
  });
  assert.equal(result.campaignCount, 1);
  assert.equal(result.summary.totals.sends, 550);
  assert.equal(result.recordCount, 55);
  assert.equal(result.records.length, 25);
  assert.equal(result.detail?.rows, 55);
  assert.equal(csv(records, filters).split("\r\n").length, 56);
  assert.equal(
    query(records, { ...base, filters, selected: "Original", recordPage: 3 })
      .records.length,
    5,
  );
  assert.equal(
    csv(
      [{ ...row, d: "2026-01-01", c: '=formula;"quote"' }],
      defaults,
    ).includes("'=formula;"),
    true,
  );
});
test("Quality CSV exports every matching incident once, independently of current page", () => {
  const rows = Array.from({ length: 60 }, () => ({
    ...row,
    d: "2026-01-01",
    e: 0,
    uo: 8,
    cm: 0 as const,
  }));
  const result = query(rows, { ...base, issue: "all", recordPage: 2 });
  assert.equal(result.recordCount, 60);
  assert.equal(result.records.length, 25);
  assert.equal(csv(rows, defaults, "all").split("\r\n").length, 61);
  assert.equal(csv(rows, defaults, "rateOver100").split("\r\n").length, 1);
});
test("Hash links preserve view and exact filters; invalid dates degrade to historical", () => {
  const filters = {
    ...defaults,
    period: "custom" as const,
    from: "2026-01-01",
    to: "2026-02-01",
    campaignExact: "Ñ & campaña",
    purpose: "Informacion",
  };
  assert.deepEqual(readHash(makeHash("campanas", filters), overview), {
    view: "campanas",
    filters,
  });
  assert.equal(
    readHash("#/calidad?period=custom&from=2026-02-31&to=2026-03-04", overview)
      .filters.period,
    "all",
  );
  assert.equal(readHash("#/missing", overview).view, "resumen");
});
test("Reject mixed hashes and corrupt record counts before combining overview/detail", () => {
  assert.doesNotThrow(() => validateDetail(dataset, overview));
  assert.throws(
    () =>
      validateDetail(
        { ...dataset, meta: { ...dataset.meta, dataHash: "different" } },
        overview,
      ),
    /DATA_CHANGED/,
  );
});
test("Full 32k-row queries stay below the 150ms target after warmup", () => {
  query(dataset.records, base);
  const measurements = Array.from({ length: 5 }, () => {
    const start = performance.now();
    query(dataset.records, base);
    return performance.now() - start;
  });
  measurements.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      rows: dataset.records.length,
      medianQueryMs: measurements[2],
      slowestMs: measurements[4],
      overviewBytes: readFileSync(
        new URL("../public/data/overview.json", import.meta.url),
      ).length,
    }),
  );
  assert.ok(measurements[2] < 150, `Query median ${measurements[2]}ms`);
});
