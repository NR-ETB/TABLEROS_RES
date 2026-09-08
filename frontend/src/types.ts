export type RecordRow = {
  d: string
  sy: number
  p: string
  c: string
  f: string
  g: string
  e: number
  sb: number
  hb: number
  uo: number
  uc: number
  t: string
  s: string
  l: string
  cm: 0 | 1
  fm: 0 | 1
}

export type DashboardData = {
  meta: {
    title: string
    spreadsheetId: string
    sourceMode: string
    generatedAtUtc: string
    earliestSentDate: string
    latestSentDate: string
    rowCount: number
    dataHash: string
    formulaNotes: Record<string, string>
  }
  totals: Record<string, number>
  quality: {
    campaignMatchPct: number
    folderMatchPct: number
    unmatchedCampaignRows: number
    unmatchedFolderRows: number
    sourceYearMismatchRows: number
    rowsWithoutSentDate: number
    calculatedRateOver100Rows: number
    duplicateCampaignCatalogKeys: number
    topUnmatchedCampaigns: { name: string; rows: number }[]
    topUnmatchedFolders: { name: string; rows: number }[]
  }
  filters: {
    purposes: string[]
    folders: string[]
    programs: string[]
    campaigns: string[]
    types: string[]
    statuses: string[]
  }
  records: RecordRow[]
}

export type Filters = {
  from: string
  to: string
  purpose: string
  folder: string
  program: string
  type: string
  status: string
  campaign: string
  quality: string
}
