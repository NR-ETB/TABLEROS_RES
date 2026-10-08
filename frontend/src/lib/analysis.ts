import type {
  DashboardData,
  CatalogEntry,
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
  subject: "Asunto contiene",
  sender: "Remitente contiene",
  searchIn: "Buscar en",
  catalogPresence: "Actividad del catálogo",
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
  if (key === "searchIn")
    return value === "all" ? "Todos los campos" : "Nombre";
  if (key === "catalogPresence")
    return value === "with"
      ? "Con registros en el corte"
      : "Sin registros en el corte";
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
    subject: "",
    sender: "",
    searchIn: "",
    catalogPresence: "",
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
  catalog: CatalogEntry[] = [],
): RecordRow[] {
  const search = fold(filters.campaign).split(/\s+/).filter(Boolean);
  const index = catalogIndex(catalog);
  const nameCache = new Map<string, string>(),
    textCache = new Map<string, string>();
  const normalizedName = (name: string) => {
    let key = nameCache.get(name);
    if (key === undefined) {
      key = fold(name);
      nameCache.set(name, key);
    }
    return key;
  };
  const matchingKeys = (
    search: string,
    text: (entry: CatalogEntry) => string,
  ) =>
    search
      ? new Set(
          [...index]
            .filter(([, entries]) =>
              entries.some((entry) => matches(text(entry), search)),
            )
            .map(([key]) => key),
        )
      : null;
  const subjects = matchingKeys(filters.subject, (entry) =>
    String(entry.fields.Asunto || ""),
  );
  const senders = matchingKeys(filters.sender, (entry) =>
    [
      entry.fields.Nombre_Envio,
      entry.fields.Correo_Envio,
      entry.fields.Correo_Respuesta,
    ].join(" "),
  );
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
    if (filters.list && !matches(row.l, filters.list)) return false;
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
    const key =
      subjects || senders || search.length ? normalizedName(row.c) : "";
    if (subjects && !subjects.has(key)) return false;
    if (senders && !senders.has(key)) return false;
    if (search.length) {
      let text = key;
      if (filters.searchIn === "all") {
        const original = [row.c, row.g, row.f, row.p, row.l].join(" ");
        text = textCache.get(original) || "";
        if (!text) {
          text = fold(
            [
              original,
              ...(index.get(key) || []).flatMap((entry) =>
                Object.values(entry.fields),
              ),
            ].join(" "),
          );
          textCache.set(original, text);
        }
      }
      if (!search.every((word) => text.includes(word))) return false;
    }
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
export const fold = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
export const matches = (text: string, search: string) =>
  fold(search)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => fold(text).includes(word));
const indexes = new WeakMap<CatalogEntry[], Map<string, CatalogEntry[]>>();
function catalogIndex(catalog: CatalogEntry[]) {
  let index = indexes.get(catalog);
  if (!index) {
    index = new Map();
    for (const entry of catalog) {
      const key = fold(String(entry.fields.Nombre || ""));
      index.set(key, [...(index.get(key) || []), entry]);
    }
    indexes.set(catalog, index);
  }
  return index;
}
export function inventory(
  catalog: CatalogEntry[],
  records: RecordRow[],
  filters: Filters,
) {
  const activity = new Map<string, number>(),
    originals = new Map<string, number>();
  for (const row of filterRows(records, {
    ...filters,
    campaign: "",
    campaignExact: "",
    subject: "",
    sender: "",
    searchIn: "",
  }))
    originals.set(row.c, (originals.get(row.c) || 0) + 1);
  for (const [name, count] of originals) {
    const key = fold(name);
    activity.set(key, (activity.get(key) || 0) + count);
  }
  const fields = {
    purpose: "Proposito",
    folder: "Folder",
    type: "Tipo",
    status: "Estado",
  };
  return catalog
    .filter((entry) => {
      const f = entry.fields,
        name = String(f.Nombre || "");
      if (filters.campaignExact && name !== filters.campaignExact) return false;
      if (
        !matches(
          filters.searchIn === "all" ? Object.values(f).join(" ") : name,
          filters.campaign,
        )
      )
        return false;
      if (
        !matches(String(f.Asunto || ""), filters.subject) ||
        !matches(
          [f.Nombre_Envio, f.Correo_Envio, f.Correo_Respuesta].join(" "),
          filters.sender,
        ) ||
        !matches(String(f.Lista || ""), filters.list)
      )
        return false;
      for (const [key, column] of Object.entries(fields))
        if (
          filters[key as keyof Filters] &&
          String(f[column] || "Sin dato") !== filters[key as keyof Filters]
        )
          return false;
      const count = activity.get(fold(name)) || 0;
      return (
        !filters.catalogPresence ||
        (filters.catalogPresence === "with" ? count > 0 : count === 0)
      );
    })
    .map((entry) => ({
      ...entry,
      activity: activity.get(fold(String(entry.fields.Nombre || ""))) || 0,
    }));
}
export function summarize(
  records: RecordRow[],
  filters: Filters,
  catalog: CatalogEntry[] = [],
): Summary {
  const rows = filterRows(records, filters, true, catalog);
  const { from, to } = filters;
  const monthly = utc(to) - utc(from) > 120 * DAY;
  const buckets = new Map<string, RecordRow[]>();
  for (const row of rows)
    if (row.d) {
      const label = row.d.slice(0, monthly ? 7 : 10);
      const bucket = buckets.get(label);
      if (bucket) bucket.push(row);
      else buckets.set(label, [row]);
    }
  const trend: Summary["trend"] = [];
  for (let cursor = utc(from); cursor <= utc(to); ) {
    const label = iso(cursor).slice(0, monthly ? 7 : 10);
    const bucket = buckets.get(label),
      count = bucket ? totals(bucket) : null;
    trend.push({
      label,
      value: count?.sends ?? null,
      opens: count?.opens ?? null,
      clicks: count?.clicks ?? null,
      bounces: count?.bounces ?? null,
      rows: count?.rows ?? null,
    });
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
    const previousRows = filterRows(
      records,
      {
        ...filters,
        from: previousFrom,
        to: previousTo,
      },
      true,
      catalog,
    );
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
export function query(
  records: RecordRow[],
  request: Query,
  catalog: CatalogEntry[] = [],
): QueryResult {
  const rows = filterRows(records, request.filters, true, catalog);
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
  const catalogRows = request.catalogMode
    ? inventory(catalog, records, request.filters).sort(
        (a, b) =>
          textOrder(String(a.fields.Nombre), String(b.fields.Nombre)) ||
          a.row - b.row,
      )
    : [];
  const unique = (key: keyof RecordRow) => [
    ...new Set(detailRows.map((r) => String(r[key] || "Sin dato"))),
  ];
  const dates = detailRows
    .map((r) => r.d)
    .filter(Boolean)
    .sort();
  return {
    summary: summarize(records, request.filters, catalog),
    inventory: catalogRows.slice(
      (request.page - 1) * pageSize,
      request.page * pageSize,
    ),
    inventoryCount: catalogRows.length,
    inventoryCoverage: {
      withRecords: catalogRows.filter((entry) => entry.activity > 0).length,
      withoutRecords: catalogRows.filter((entry) => !entry.activity).length,
    },
    catalogDetail:
      request.selected === null
        ? []
        : catalogIndex(catalog).get(fold(request.selected)) || [],
    campaignInfo:
      request.selected === null
        ? null
        : {
            from: dates[0] || "",
            to: dates.at(-1) || "",
            folders: unique("f"),
            programs: unique("g"),
            purposes: unique("p"),
            types: unique("t"),
            statuses: unique("s"),
            lists: unique("l"),
          },
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
  catalog: CatalogEntry[] = [],
): string {
  const rows = filterRows(records, filters, true, catalog).filter(
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
  const sourceKeys = [
    ...new Set(rows.flatMap((row) => Object.keys(row.source || {}))),
  ];
  const catalogKeys = [
    ...new Set(catalog.flatMap((entry) => Object.keys(entry.fields))),
  ];
  const index = catalogIndex(catalog);
  return (
    "\uFEFF" +
    [
      [
        ...header,
        ...sourceKeys.map((key) => `Fuente: ${key}`),
        ...catalogKeys.map((key) => `Catálogo: ${key}`),
      ],
      ...rows.map((r) => {
        const entries = index.get(fold(r.c)) || [];
        const selected = [...entries].sort(
          (a, b) =>
            Number(
              ["ACTIVE", "A", "ACTIVO"].includes(
                String(b.fields.Estado).toUpperCase(),
              ),
            ) -
              Number(
                ["ACTIVE", "A", "ACTIVO"].includes(
                  String(a.fields.Estado).toUpperCase(),
                ),
              ) || Number(b.fields.ID || 0) - Number(a.fields.ID || 0),
        )[0];
        return [
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
          ...sourceKeys.map((key) => r.source?.[key] ?? ""),
          ...catalogKeys.map((key) => selected?.fields[key] ?? ""),
        ];
      }),
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
