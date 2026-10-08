export type RecordRow = {
  source?: Record<string, string | number | null>;
  d: string;
  sy: number;
  p: string;
  c: string;
  f: string;
  g: string;
  e: number;
  sb: number;
  hb: number;
  uo: number;
  uc: number;
  t: string;
  s: string;
  l: string;
  cm: 0 | 1;
  fm: 0 | 1;
};

export type DashboardData = {
  catalog?: CatalogEntry[];
  meta: {
    title: string;
    spreadsheetId: string;
    sourceMode: string;
    generatedAtUtc: string;
    earliestSentDate: string;
    latestSentDate: string;
    rowCount: number;
    dataHash: string;
    formulaNotes: Record<string, string>;
  };
  totals: Record<string, number>;
  quality: {
    campaignMatchPct: number;
    folderMatchPct: number;
    unmatchedCampaignRows: number;
    unmatchedFolderRows: number;
    sourceYearMismatchRows: number;
    rowsWithoutSentDate: number;
    calculatedRateOver100Rows: number;
    duplicateCampaignCatalogKeys: number;
    topUnmatchedCampaigns: { name: string; rows: number }[];
    topUnmatchedFolders: { name: string; rows: number }[];
  };
  filters: {
    purposes: string[];
    folders: string[];
    programs: string[];
    campaigns: string[];
    types: string[];
    statuses: string[];
  };
  records: RecordRow[];
};

export type Filters = {
  period: Period;
  campaignExact: string;
  from: string;
  to: string;
  purpose: string;
  folder: string;
  program: string;
  type: string;
  status: string;
  campaign: string;
  quality: string;
  list: string;
  sourceYear: string;
  minSends: string;
  maxSends: string;
  activity: string;
  subject: string;
  sender: string;
  searchIn: string;
  catalogPresence: string;
};

export type ReportFormat =
  | "campaigns"
  | "days"
  | "records"
  | "quality"
  | "html"
  | "inventory";
export type ReportRequest = {
  filters: Filters;
  format: ReportFormat;
  issue?: string;
};
export type ReportResult = { content: string; rowCount: number };

export type Period = "all" | "last30" | "last90" | "latestYear" | "custom";
export type View = "resumen" | "campanas" | "calidad" | "inventario";
export type CatalogEntry = {
  row: number;
  fields: Record<string, string | number | null>;
};
export type Totals = {
  sends: number;
  opens: number;
  clicks: number;
  soft: number;
  hard: number;
  rows: number;
  bounces: number;
  delivered: number;
};
export type Coverage = { daysWithRecords: number; calendarDays: number };
export type Group = { label: string; value: number; other: boolean };
export type Issue =
  | "missingCampaign"
  | "unmatchedCampaign"
  | "unmatchedFolder"
  | "zeroSendActivity"
  | "rateOver100"
  | "dateMismatch"
  | "withoutDate";
export type Quality = Record<Issue | "fullMatch" | "anomalyRows", number>;
export type Summary = {
  from: string;
  to: string;
  totals: Totals;
  coverage: Coverage;
  comparison: {
    from: string;
    to: string;
    totals: Totals;
    coverage: Coverage;
  } | null;
  trend: {
    label: string;
    value: number | null;
    opens: number | null;
    clicks: number | null;
    bounces: number | null;
    rows: number | null;
  }[];
  topCampaigns: Group[];
  folders: Group[];
  purposes: Group[];
  quality: Quality;
};
export type OverviewData = {
  schemaVersion: 2;
  meta: DashboardData["meta"];
  filters: DashboardData["filters"];
  sourceQuality: DashboardData["quality"];
  summaries: Record<Exclude<Period, "custom">, Summary>;
};
export type Campaign = { name: string; totals: Totals };
export type Query = {
  filters: Filters;
  page: number;
  sort: "sends" | "opens" | "clicks" | "name";
  ascending: boolean;
  selected: string | null;
  recordPage: number;
  issue: string;
  pageSize?: number;
  recordPageSize?: number;
  catalogMode?: boolean;
};
export type QueryResult = {
  summary: Summary;
  campaigns: Campaign[];
  campaignCount: number;
  records: RecordRow[];
  recordCount: number;
  detail: Totals | null;
  inventory: (CatalogEntry & { activity: number })[];
  inventoryCount: number;
  inventoryCoverage: { withRecords: number; withoutRecords: number };
  catalogDetail: CatalogEntry[];
  campaignInfo: {
    from: string;
    to: string;
    folders: string[];
    programs: string[];
    purposes: string[];
    types: string[];
    statuses: string[];
    lists: string[];
  } | null;
};
