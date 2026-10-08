export type RecordRow = {
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
};

export type ReportFormat =
  "campaigns" | "days" | "records" | "quality" | "html";
export type ReportRequest = {
  filters: Filters;
  format: ReportFormat;
  issue?: string;
};
export type ReportResult = { content: string; rowCount: number };

export type Period = "all" | "last30" | "last90" | "latestYear" | "custom";
export type View = "resumen" | "campanas" | "calidad";
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
  trend: { label: string; value: number | null }[];
  topCampaigns: Group[];
  folders: Group[];
  purposes: Group[];
  quality: Quality;
};
export type OverviewData = {
  schemaVersion: 1;
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
};
export type QueryResult = {
  summary: Summary;
  campaigns: Campaign[];
  campaignCount: number;
  records: RecordRow[];
  recordCount: number;
  detail: Totals | null;
};
