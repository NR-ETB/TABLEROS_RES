import {
  csv,
  filterRows,
  flags,
  issueLabels,
  totals,
  filterLabels,
  filterValue,
  inventory,
} from "./analysis.ts";
import type {
  OverviewData,
  RecordRow,
  ReportRequest,
  ReportResult,
  Totals,
  CatalogEntry,
} from "../types.ts";

export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function rangeError(from: string, to: string): string {
  return !validDate(from) || !validDate(to) || from > to
    ? "Selecciona fechas válidas: Desde debe ser anterior o igual a Hasta."
    : "";
}
const rate = (count: number, sends: number) =>
  sends
    ? ((100 * count) / sends).toLocaleString("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
      })
    : "";
const escapeHtml = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const cell = (value: unknown) => {
  let text = String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
};
const encode = (rows: unknown[][]) =>
  "\ufeff" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
const metrics = (value: Totals) => [
  value.rows,
  value.sends,
  value.delivered,
  value.opens,
  value.clicks,
  value.bounces,
  rate(value.delivered, value.sends),
  rate(value.opens, value.sends),
  rate(value.clicks, value.sends),
  rate(value.bounces, value.sends),
];
const headers = [
  "Registros",
  "Envíos",
  "Entregados",
  "Aperturas únicas",
  "Clics únicos",
  "Rebotes",
  "Entrega (%)",
  "Aperturas/envíos (%)",
  "Clics/envíos (%)",
  "Rebotes (%)",
];

function groupRows(rows: RecordRow[], field: "c" | "d") {
  const groups = new Map<string, RecordRow[]>();
  for (const row of rows) {
    const name = row[field] || "Sin dato";
    const group = groups.get(name);
    if (group) group.push(row);
    else groups.set(name, [row]);
  }
  return [...groups]
    .map(([name, records]) => ({ name, totals: totals(records) }))
    .sort((a, b) =>
      field === "d"
        ? a.name.localeCompare(b.name)
        : b.totals.sends - a.totals.sends || a.name.localeCompare(b.name),
    );
}

/** Date-bounded reports never treat unknown dates as belonging to the chosen range. */
export function report(
  records: RecordRow[],
  overview: OverviewData,
  request: ReportRequest,
  catalog: CatalogEntry[] = [],
): ReportResult {
  const { filters, format, issue } = request;
  const invalid = rangeError(filters.from, filters.to);
  if (invalid) throw new Error(invalid);
  if (format === "inventory") {
    const entries = inventory(catalog, records, filters);
    const keys = [
      ...new Set(catalog.flatMap((entry) => Object.keys(entry.fields))),
    ];
    return {
      rowCount: entries.length,
      content: encode([
        [
          "Fila catálogo",
          ...keys,
          "Registros en el corte",
          "Desde actividad",
          "Hasta actividad",
        ],
        ...entries.map((entry) => [
          entry.row,
          ...keys.map((key) => entry.fields[key] ?? ""),
          entry.activity,
          filters.from,
          filters.to,
        ]),
      ]),
    };
  }
  let rows = filterRows(
    records.filter((r) => !!r.d && r.d >= filters.from && r.d <= filters.to),
    filters,
    true,
    catalog,
  );
  if (format === "quality")
    rows = rows.filter((r) =>
      issue && issue in issueLabels
        ? flags(r)[issue as keyof typeof issueLabels]
        : Object.values(flags(r)).some(Boolean),
    );
  if (format === "records" || format === "quality")
    return {
      content: csv(rows, filters, undefined, catalog),
      rowCount: rows.length,
    };
  const groups = groupRows(rows, format === "days" ? "d" : "c");
  if (format !== "html")
    return {
      content: encode([
        [format === "days" ? "Fecha" : "Campaña", "Desde", "Hasta", ...headers],
        ...groups.map((g) => [
          g.name,
          filters.from,
          filters.to,
          ...metrics(g.totals),
        ]),
      ]),
      rowCount: rows.length,
    };
  const summary = totals(rows);
  const number = (value: number) =>
    new Intl.NumberFormat("es-CO").format(value);
  const active =
    Object.entries(filters)
      .filter(
        ([key, value]) => value && !["period", "from", "to"].includes(key),
      )
      .map(
        ([key, value]) =>
          `${filterLabels[key] || key}: ${filterValue(key, value)}`,
      )
      .join(" · ") || "Sin filtros adicionales";
  const indicators = [
    ["Envíos", number(summary.sends)],
    [
      "Entrega",
      summary.sends ? rate(summary.delivered, summary.sends) + "%" : "N/D",
    ],
    [
      "Aperturas/envíos",
      summary.sends ? rate(summary.opens, summary.sends) + "%" : "N/D",
    ],
    [
      "Clics/envíos",
      summary.sends ? rate(summary.clicks, summary.sends) + "%" : "N/D",
    ],
    ["Rebotes", number(summary.bounces)],
  ]
    .map(
      ([label, value]) =>
        `<div><small>${label}</small><strong>${value}</strong></div>`,
    )
    .join("");
  const tableHead = [
    "Campaña",
    "Registros",
    "Envíos",
    "Aperturas",
    "Clics",
    "Rebotes",
  ]
    .map((h) => `<th scope="col">${h}</th>`)
    .join("");
  const tableRows = groups
    .map(
      (g) =>
        `<tr><td>${escapeHtml(g.name)}</td>${[g.totals.rows, g.totals.sends, g.totals.opens, g.totals.clicks, g.totals.bounces].map((n) => `<td>${number(n)}</td>`).join("")}</tr>`,
    )
    .join("");
  const content = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ETB · Responsys — ${escapeHtml(filters.from)} a ${escapeHtml(filters.to)}</title><style>
  :root{font-family:"Segoe UI",Arial,sans-serif;color:#17375f;background:#eef3f7}body{max-width:1100px;margin:32px auto;padding:32px;background:white}header{border-top:4px solid #003c92;padding-top:20px}h1{font-size:28px;letter-spacing:-.6px;margin:0}h2{font-size:18px}p{line-height:1.5;color:#50647e}small{font-size:12px}.metrics{display:flex;flex-wrap:wrap;border-block:1px solid #d7e5ef;margin:24px 0}.metrics div{padding:16px;flex:1}.metrics strong{display:block;font-size:26px;font-variant-numeric:tabular-nums}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:10px 8px;border-bottom:1px solid #d7e5ef;text-align:right;vertical-align:top}th:first-child,td:first-child{text-align:left;overflow-wrap:anywhere}th{background:#eef3f7}thead{display:table-header-group}tr{break-inside:avoid}footer{border-top:1px solid #d7e5ef;margin-top:24px;padding-top:16px;font-size:12px}@media print{:root{background:white}body{max-width:none;margin:0;padding:0}@page{size:A4 landscape;margin:16mm}}
  </style></head><body><header><h1>ETB · Responsys</h1><p>Rendimiento de campañas · ${escapeHtml(filters.from)} al ${escapeHtml(filters.to)} · fechas inclusivas</p></header>
  <p><small>${escapeHtml(active)}</small></p><section class="metrics">${indicators}</section><h2>${number(groups.length)} campañas · ${number(rows.length)} registros</h2>
  ${groups.length ? `<table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table>` : "<p>Sin registros para este rango y filtros.</p>"}
  <footer><p>Fuente: ${overview.meta.sourceMode === "google" ? "Google Sheets · sincronización lectora" : "Snapshot versionado · sin conexión viva"}. Corte: ${escapeHtml(overview.meta.latestSentDate)}. Sincronización: ${escapeHtml(overview.meta.generatedAtUtc)}. Datos: ${escapeHtml(overview.meta.dataHash)}.</p>
  <p>Se excluyen registros sin fecha. Tasas calculadas a partir de sumas de conteos. Aperturas y clics únicos pueden repetirse entre registros; los días con registros no certifican integridad. No se eliminan incidencias. Este informe puede imprimirse o guardarse como PDF desde el navegador.</p></footer></body></html>`;
  return { content, rowCount: rows.length };
}
