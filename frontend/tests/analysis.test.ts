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
import { report, rangeError } from "../src/lib/reports.ts";
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
test("Activity, list, origin year and send bounds filter before aggregating and survive shared links", () => {
  const records = [
    { ...row, d: "2026-09-01", sy: 2026, l: "Lista Principal", e: 100, uc: 5 },
    { ...row, d: "2026-09-01", sy: 2025, l: "Lista Principal", e: 100, uc: 5 },
    { ...row, d: "2026-09-01", sy: 2026, l: "Otra", e: 100, uc: 5 },
    { ...row, d: "2026-09-01", sy: 2026, l: "Lista Principal", e: 99, uc: 5 },
    { ...row, d: "2026-09-01", sy: 2026, l: "Lista Principal", e: 101, uc: 5 },
    { ...row, d: "2026-09-01", sy: 2026, l: "Lista Principal", e: 100, uc: 0 },
  ];
  const filters = {
    ...defaults,
    list: "PRINCIPAL",
    sourceYear: "2026",
    minSends: "100",
    maxSends: "100",
    activity: "clicks",
  };
  assert.deepEqual(filterRows(records, filters), [records[0]]);
  assert.equal(query(records, { ...base, filters }).summary.totals.sends, 100);
  assert.deepEqual(
    readHash(makeHash("resumen", filters), overview).filters,
    filters,
  );
  assert.equal(
    readHash("#/resumen?minSends=-1&maxSends=oops&activity=unknown", overview)
      .filters.minSends,
    "",
  );
  assert.equal(
    filterRows([{ ...row, d: "2026-09-01", e: 0 }], {
      ...defaults,
      maxSends: "0",
    }).length,
    1,
  );
  assert.equal(
    filterRows([{ ...row, d: "2026-09-01", uo: 0, uc: 0, hb: 0, sb: 0 }], {
      ...defaults,
      activity: "none",
    }).length,
    1,
  );
});
test("Date reports use inclusive boundaries, preserve every row, exclude unknown dates and escape campaign names", () => {
  const records = [
    { ...row, d: "2026-09-01", c: "<script>alert(1)</script>", e: 100 },
    { ...row, d: "2026-09-02", c: "=FORMULA", e: 200 },
    { ...row, d: "2026-09-03", e: 500 },
    { ...row, d: "", e: 900 },
  ];
  const filters = {
    ...defaults,
    period: "custom" as const,
    from: "2026-09-01",
    to: "2026-09-02",
  };
  for (const format of ["campaigns", "days", "records", "html"] as const) {
    const result = report(records, overview, { filters, format });
    assert.equal(result.rowCount, 2);
    if (format === "html") {
      assert.ok(result.content.includes("&lt;script&gt;"));
      assert.ok(!result.content.includes("<script>"));
      assert.ok(result.content.includes(overview.meta.dataHash));
    } else assert.equal(result.content.split("\r\n").length, 3);
    if (format === "campaigns") assert.ok(result.content.includes("'=FORMULA"));
  }
  assert.equal(
    report(records, overview, {
      filters: { ...filters, quality: "withoutDate" },
      format: "quality",
    }).rowCount,
    0,
  );
  assert.ok(rangeError("2026-02-31", "2026-03-01"));
  assert.ok(rangeError("2026-09-02", "2026-09-01"));
  const empty = report(records, overview, {
    filters: { ...filters, from: "2020-01-01", to: "2020-01-02" },
    format: "html",
  });
  assert.equal(empty.rowCount, 0);
  assert.ok(empty.content.includes("Sin registros"));
});
test("Reports agree with all snapshot metrics, campaign totals and quality union independently of pagination", () => {
  const reportAll = report(dataset.records, overview, {
    filters: defaults,
    format: "campaigns",
  });
  assert.equal(
    reportAll.rowCount,
    filterRows(dataset.records, defaults).length,
  );
  const campaigns = reportAll.content.split("\r\n").slice(1);
  const sends = campaigns.reduce(
    (sum, line) => sum + Number(line.split('";"')[4]),
    0,
  );
  assert.equal(sends, overview.summaries.all.totals.sends);
  assert.equal(campaigns.length, query(dataset.records, base).campaignCount);
  const quality = report(dataset.records, overview, {
    filters: defaults,
    format: "quality",
  });
  assert.equal(quality.rowCount, overview.summaries.all.quality.anomalyRows);
  assert.equal(quality.content.split("\r\n").length, quality.rowCount + 1);
});
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
test("Viewport pagination reaches every campaign and record without changing totals or CSV", () => {
  const rows = Array.from({ length: 31 }, (_, index) => ({
    ...row,
    c: `Campaña ${index}`,
    d: "2025-01-01",
    cm: 0 as const,
  }));
  for (const pageSize of [1, 3, 7, 25]) {
    const campaigns: string[] = [],
      records: RecordRow[] = [];
    for (let page = 1; page <= Math.ceil(rows.length / pageSize); page++) {
      const answer = query(rows, {
        ...base,
        page,
        recordPage: page,
        pageSize,
        recordPageSize: pageSize,
      });
      assert.equal(answer.summary.totals.sends, 310);
      assert.equal(answer.campaignCount, 31);
      assert.equal(answer.recordCount, 31);
      campaigns.push(...answer.campaigns.map((item) => item.name));
      records.push(...answer.records);
    }
    assert.equal(new Set(campaigns).size, 31);
    assert.deepEqual(records, rows);
    assert.equal(csv(rows, defaults).split("\r\n").length, 32);
  }
  assert.equal(query(rows, { ...base, pageSize: 0 }).campaigns.length, 1);
  assert.equal(query(rows, { ...base, pageSize: 100 }).campaigns.length, 25);
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

test("Full catalog includes duplicates and campaigns without statistics; searches tolerate accents and word order", () => {
  const catalog = [
    {
      row: 2,
      fields: {
        ID: 7,
        Nombre: "Campaña Ágil",
        Asunto: "Factura nueva ETB",
        Nombre_Envio: "Comunicaciones",
        Correo_Envio: "marca@etb.com",
        Estado: "ACTIVE",
        Lista: "Lista Única",
      },
    },
    {
      row: 3,
      fields: {
        ID: 8,
        Nombre: "Campaña Ágil",
        Asunto: "Versión anterior",
        Estado: "CLOSED",
      },
    },
    {
      row: 4,
      fields: {
        ID: 9,
        Nombre: "Solo catálogo",
        Asunto: "Sin actividad",
        Estado: "ACTIVE",
      },
    },
  ];
  const records = [
    { ...row, c: "Campaña Ágil", d: defaults.from, l: "Lista Única" },
  ];
  const all = query(records, { ...base, catalogMode: true }, catalog);
  assert.equal(all.inventoryCount, 3);
  assert.equal(all.campaignCount, 1);
  assert.equal(all.summary.totals.sends, row.e);
  assert.equal(
    query(
      records,
      {
        ...base,
        catalogMode: true,
        filters: { ...defaults, catalogPresence: "without" },
      },
      catalog,
    ).inventoryCount,
    1,
  );
  assert.equal(
    query(
      records,
      { ...base, filters: { ...defaults, campaign: "agil campana" } },
      catalog,
    ).campaignCount,
    1,
  );
  assert.equal(
    query(
      records,
      {
        ...base,
        filters: { ...defaults, campaign: "7 factura", searchIn: "all" },
      },
      catalog,
    ).campaignCount,
    1,
  );
  assert.equal(
    query(
      records,
      {
        ...base,
        filters: { ...defaults, subject: "etb factura", sender: "marca" },
      },
      catalog,
    ).campaignCount,
    1,
  );
  assert.equal(
    query(records, { ...base, selected: "Campaña Ágil" }, catalog).catalogDetail
      .length,
    2,
  );
  const exported = report(
    records,
    overview,
    { filters: defaults, format: "inventory" },
    catalog,
  );
  assert.equal(exported.rowCount, 3);
  assert.match(exported.content, /Solo catálogo/);
  assert.match(exported.content, /Correo_Envio/);
  assert.equal(exported.content.split("\r\n").length, 4);
  const f = {
    ...defaults,
    subject: "factura",
    sender: "marca",
    searchIn: "all",
    catalogPresence: "without",
  };
  assert.deepEqual(readHash(makeHash("inventario", f), overview), {
    view: "inventario",
    filters: f,
  });
});

test("Original source columns and all catalog fields survive record exports; trend metrics agree with counts", () => {
  const original = {
    ...row,
    d: defaults.from,
    c: "Campaña Ágil",
    source: {
      ID: 123,
      "Spam Complaints Rate": "0.01%",
      "Launch Date": null,
      "Sent Date": 45292,
      "Asunto peligroso": "=1+1",
    },
  };
  const catalog = [
    {
      row: 2,
      fields: {
        ID: 7,
        Nombre: "Campaña Ágil",
        Asunto: "Hola",
        Correo_Respuesta: "respuesta@etb.com",
      },
    },
  ];
  const exported = csv([original], defaults, undefined, catalog);
  assert.match(exported, /Fuente: Spam Complaints Rate/);
  assert.match(exported, /Catálogo: Correo_Respuesta/);
  assert.match(exported, /'=1\+1/);
  const summary = summarize([original], {
    ...defaults,
    from: defaults.from,
    to: defaults.from,
    period: "custom",
  });
  assert.deepEqual(summary.trend[0], {
    label: defaults.from,
    value: original.e,
    opens: original.uo,
    clicks: original.uc,
    bounces: original.sb + original.hb,
    rows: 1,
  });
  assert.equal(dataset.catalog?.length, 1812);
  assert.ok(
    dataset.records.every(
      (r) => r.source && Object.keys(r.source).length >= 18,
    ),
  );
});
