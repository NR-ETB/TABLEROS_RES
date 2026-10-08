import type {
  DashboardData,
  Filters,
  Group,
  Issue,
  OverviewData,
  Period,
  Query,
  QueryResult,
  RecordRow,
  Summary,
  Totals,
} from "../types.ts";

const DAY = 86400000;
const utc = (date: string) => Date.parse(date + "T00:00:00Z");
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
export const filterLabels: Record<string, string> = {
  purpose: "Propósito",
  folder: "Folder",
  program: "Programa",
  type: "Tipo",
  status: "Estado",
  campaign: "Campaña contiene",
  campaignExact: "Campaña exacta",
  quality: "Calidad",
  list: "Lista contiene",
  sourceYear: "Año de origen",
  minSends: "Envíos mínimos",
  maxSends: "Envíos máximos",
  activity: "Actividad",
};
export const issueLabels: Record<Issue, string> = {
  missingCampaign: "Campaña ausente",
  unmatchedCampaign: "Cruce de campaña fallido",
  unmatchedFolder: "Cruce de folder fallido",
  zeroSendActivity: "Actividad sin envíos",
  rateOver100: "Tasa superior al 100%",
  dateMismatch: "Año de origen discrepante",
  withoutDate: "Fecha desconocida",
};
export function filterValue(key: string, value: string): string {
  if (key === "activity")
    return (
      (
        {
          opens: "Con aperturas",
          clicks: "Con clics",
          bounces: "Con rebotes",
          none: "Sin actividad",
        } as Record<string, string>
      )[value] || value
    );
  if (key === "quality")
    return (
      issueLabels[value as Issue] ||
      (
        {
          fullMatch: "Cruces completos",
          anomalyRows: "Con incidencias",
        } as Record<string, string>
      )[value] ||
      value
    );
  return value;
}
export function periodDates(
  meta: DashboardData["meta"],
  period: Period,
): [string, string] {
  let from = meta.earliestSentDate;
  const to = meta.latestSentDate;
  if (period === "last30" || period === "last90")
    from = [
      from,
      iso(utc(to) - (period === "last30" ? 29 : 89) * DAY),
    ].sort()[1];
  if (period === "latestYear")
    from = [from, to.slice(0, 4) + "-01-01"].sort()[1];
  return [from, to];
}
export function defaultFilters(meta: DashboardData["meta"]): Filters {
  const [from, to] = periodDates(meta, "all");
  return {
    period: "all",
    from,
    to,
    purpose: "",
    folder: "",
    program: "",
    type: "",
    status: "",
    campaign: "",
    campaignExact: "",
    quality: "",
    list: "",
    sourceYear: "",
    minSends: "",
    maxSends: "",
    activity: "",
  };
}
export function flags(row: RecordRow): Record<Issue, boolean> {
  return {
    missingCampaign: !row.c,
    unmatchedCampaign: !row.cm,
    unmatchedFolder: !row.fm,
    zeroSendActivity:
      row.e === 0 && (row.sb > 0 || row.hb > 0 || row.uo > 0 || row.uc > 0),
    rateOver100: row.e > 0 && Math.max(row.uo, row.uc, row.sb + row.hb) > row.e,
    dateMismatch: !!row.d && Number(row.d.slice(0, 4)) !== row.sy,
    withoutDate: !row.d,
  };
}
export function filterRows(
  records: RecordRow[],
  filters: Filters,
  dated = true,
): RecordRow[] {
  const search = filters.campaign.trim().toLocaleLowerCase("es");
  return records.filter((row) => {
    if (
      dated &&
      filters.quality !== "withoutDate" &&
      (!row.d || row.d < filters.from || row.d > filters.to)
    )
      return false;
    if (filters.purpose && (row.p || "Sin dato") !== filters.purpose)
      return false;
    if (filters.folder && (row.f || "Sin dato") !== filters.folder)
      return false;
    if (filters.program && (row.g || "Sin dato") !== filters.program)
      return false;
    if (filters.type && (row.t || "Sin dato") !== filters.type) return false;
    if (filters.status && (row.s || "Sin dato") !== filters.status)
      return false;
    if (
      filters.list &&
      !row.l
        .toLocaleLowerCase("es")
        .includes(filters.list.trim().toLocaleLowerCase("es"))
    )
      return false;
    if (filters.sourceYear && row.sy !== Number(filters.sourceYear))
      return false;
    if (filters.minSends !== "" && row.e < Number(filters.minSends))
      return false;
    if (filters.maxSends !== "" && row.e > Number(filters.maxSends))
      return false;
    if (filters.activity === "opens" && row.uo <= 0) return false;
    if (filters.activity === "clicks" && row.uc <= 0) return false;
    if (filters.activity === "bounces" && row.sb + row.hb <= 0) return false;
    if (
      filters.activity === "none" &&
      (row.uo > 0 || row.uc > 0 || row.sb + row.hb > 0)
    )
      return false;
    if (
      filters.campaignExact &&
      (row.c || "Sin dato") !== filters.campaignExact
    )
      return false;
    if (search && !row.c.toLocaleLowerCase("es").includes(search)) return false;
    if (filters.quality === "fullMatch" && !(row.cm && row.fm)) return false;
    if (
      filters.quality === "anomalyRows" &&
      !Object.values(flags(row)).some(Boolean)
    )
      return false;
    if (filters.quality in issueLabels && !flags(row)[filters.quality as Issue])
      return false;
    return true;
  });
}
export function totals(rows: RecordRow[]): Totals {
  const total = {
    sends: 0,
    opens: 0,
    clicks: 0,
    soft: 0,
    hard: 0,
    rows: rows.length,
    bounces: 0,
    delivered: 0,
  };
  for (const row of rows) {
    total.sends += row.e;
    total.opens += row.uo;
    total.clicks += row.uc;
    total.soft += row.sb;
    total.hard += row.hb;
  }
  total.bounces = total.soft + total.hard;
  total.delivered = Math.max(total.sends - total.bounces, 0);
  return total;
}
const textOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function groups(
  rows: RecordRow[],
  key: "c" | "f" | "p",
  limit: number,
  other = false,
): Group[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = row[key] || "Sin dato";
    counts.set(label, (counts.get(label) || 0) + row.e);
  }
  const ordered = [...counts].sort(
    (a, b) => b[1] - a[1] || textOrder(a[0], b[0]),
  );
  const result = ordered
    .slice(0, limit)
    .map(([label, value]) => ({ label, value, other: false }));
  if (other && ordered.length > limit)
    result.push({
      label: "Otros",
      value: ordered.slice(limit).reduce((sum, item) => sum + item[1], 0),
      other: true,
    });
  return result;
}
const coverage = (rows: RecordRow[], from: string, to: string) => ({
  daysWithRecords: new Set(rows.filter((r) => r.d).map((r) => r.d)).size,
  calendarDays: Math.round((utc(to) - utc(from)) / DAY) + 1,
});
export function summarize(records: RecordRow[], filters: Filters): Summary {
  const rows = filterRows(records, filters);
  const { from, to } = filters;
  const monthly = utc(to) - utc(from) > 120 * DAY;
  const buckets = new Map<string, number>();
  for (const row of rows)
    if (row.d) {
      const label = row.d.slice(0, monthly ? 7 : 10);
      buckets.set(label, (buckets.get(label) || 0) + row.e);
    }
  const trend: Summary["trend"] = [];
  for (let cursor = utc(from); cursor <= utc(to);) {
    const label = iso(cursor).slice(0, monthly ? 7 : 10);
    trend.push({ label, value: buckets.get(label) ?? null });
    if (monthly) {
      const date = new Date(cursor);
      cursor = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
    } else cursor += DAY;
  }
  const quality = {
    missingCampaign: 0,
    unmatchedCampaign: 0,
    unmatchedFolder: 0,
    zeroSendActivity: 0,
    rateOver100: 0,
    dateMismatch: 0,
    withoutDate: 0,
    fullMatch: 0,
    anomalyRows: 0,
  };
  for (const row of rows) {
    const issue = flags(row);
    for (const key of Object.keys(issue) as Issue[])
      quality[key] += Number(issue[key]);
    quality.fullMatch += Number(!!(row.cm && row.fm));
    quality.anomalyRows += Number(Object.values(issue).some(Boolean));
  }
  let comparison: Summary["comparison"] = null;
  if (filters.period !== "all" && filters.quality !== "withoutDate") {
    const previousTo = iso(utc(from) - DAY),
      previousFrom = iso(utc(previousTo) - (utc(to) - utc(from)));
    const previousRows = filterRows(records, {
      ...filters,
      from: previousFrom,
      to: previousTo,
    });
    comparison = {
      from: previousFrom,
      to: previousTo,
      totals: totals(previousRows),
      coverage: coverage(previousRows, previousFrom, previousTo),
    };
  }
  return {
    from,
    to,
    totals: totals(rows),
    coverage: coverage(rows, from, to),
    comparison,
    trend,
    topCampaigns: groups(rows, "c", 5),
    folders: groups(rows, "f", 3, true),
    purposes: groups(rows, "p", 3, true),
    quality,
  };
}
export function query(records: RecordRow[], request: Query): QueryResult {
  const rows = filterRows(records, request.filters);
  const grouped = new Map<string, RecordRow[]>();
  for (const row of rows) {
    const name = row.c || "Sin dato";
    const group = grouped.get(name);
    if (group) group.push(row);
    else grouped.set(name, [row]);
  }
  const campaigns = [...grouped].map(([name, rows]) => ({
    name,
    totals: totals(rows),
  }));
  campaigns.sort((a, b) => {
    const order =
      request.sort === "name"
        ? textOrder(a.name, b.name)
        : a.totals[request.sort] - b.totals[request.sort];
    return (request.ascending ? order : -order) || textOrder(a.name, b.name);
  });
  const detailRows =
    request.selected === null
      ? rows.filter((row) =>
          request.issue === "all"
            ? Object.values(flags(row)).some(Boolean)
            : !!flags(row)[request.issue as Issue],
        )
      : grouped.get(request.selected) || [];
  const size = (value?: number) =>
    Number.isFinite(value) ? Math.max(1, Math.min(25, Math.floor(value!))) : 25;
  const pageSize = size(request.pageSize),
    recordPageSize = size(request.recordPageSize);
  return {
    summary: summarize(records, request.filters),
    campaigns: campaigns.slice(
      (request.page - 1) * pageSize,
      request.page * pageSize,
    ),
    campaignCount: campaigns.length,
    records: detailRows.slice(
      (request.recordPage - 1) * recordPageSize,
      request.recordPage * recordPageSize,
    ),
    recordCount: detailRows.length,
    detail: request.selected === null ? null : totals(detailRows),
  };
}
export function csv(
  records: RecordRow[],
  filters: Filters,
  issue?: string,
): string {
  const rows = filterRows(records, filters).filter(
    (row) =>
      !issue ||
      (issue === "all"
        ? Object.values(flags(row)).some(Boolean)
        : !!flags(row)[issue as Issue]),
  );
  const escape = (value: string | number) =>
    '"' +
    String(value)
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const header = [
    "Fecha",
    "Año origen",
    "Propósito",
    "Campaña",
    "Folder",
    "Programa",
    "Envíos",
    "Rebotes blandos",
    "Rebotes duros",
    "Aperturas únicas",
    "Clics únicos",
    "Tipo",
    "Estado",
    "Lista",
    "Cruce campaña",
    "Cruce folder",
  ];
  return (
    "\uFEFF" +
    [
      header,
      ...rows.map((r) => [
        r.d,
        r.sy,
        r.p,
        r.c,
        r.f,
        r.g,
        r.e,
        r.sb,
        r.hb,
        r.uo,
        r.uc,
        r.t,
        r.s,
        r.l,
        r.cm,
        r.fm,
      ]),
    ]
      .map((row) => row.map(escape).join(";"))
      .join("\r\n")
  );
}
export function validateDetail(
  data: DashboardData,
  overview: OverviewData,
): void {
  if (
    data.meta.dataHash !== overview.meta.dataHash ||
    data.meta.rowCount !== data.records.length
  )
    throw new Error("DATA_CHANGED");
}
export function change(
  current: number,
  previous: number,
  rate = false,
): string {
  if (!Number.isFinite(current) || !Number.isFinite(previous))
    return "No comparable";
  if (previous === 0 && !rate) return "No comparable";
  const value = rate
    ? current - previous
    : ((current - previous) / previous) * 100;
  return `${value > 0 ? "+" : ""}${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })}${rate ? " pp" : "%"} vs. anterior`;
}
