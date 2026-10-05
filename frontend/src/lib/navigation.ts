import { defaultFilters, periodDates } from "./analysis.ts";
import type { Filters, OverviewData, Period, View } from "../types.ts";
const periods = new Set(["all", "last30", "last90", "latestYear", "custom"]);
export function readHash(
  hash: string,
  overview: OverviewData,
): { view: View; filters: Filters } {
  const [path, search = ""] = hash.replace(/^#\/?/, "").split("?");
  const view = (
    ["resumen", "campanas", "calidad"].includes(path) ? path : "resumen"
  ) as View;
  const params = new URLSearchParams(search),
    filters = defaultFilters(overview.meta);
  filters.period = (
    periods.has(params.get("period") || "") ? params.get("period") : "all"
  ) as Period;
  const [from, to] = periodDates(overview.meta, filters.period);
  filters.from = from;
  filters.to = to;
  for (const key of [
    "purpose",
    "folder",
    "program",
    "type",
    "status",
    "campaign",
    "campaignExact",
    "quality",
  ] as const)
    filters[key] = params.get(key) || "";
  if (filters.period === "custom") {
    const valid = (value: string | null) =>
      !!value &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value;
    if (
      valid(params.get("from")) &&
      valid(params.get("to")) &&
      params.get("from")! <= params.get("to")!
    ) {
      filters.from = params.get("from")!;
      filters.to = params.get("to")!;
    } else filters.period = "all";
  }
  return { view, filters };
}
export function makeHash(view: View, filters: Filters): string {
  const params = new URLSearchParams({ period: filters.period });
  for (const [key, value] of Object.entries(filters))
    if (
      value &&
      key !== "period" &&
      (!["from", "to"].includes(key) || filters.period === "custom")
    )
      params.set(key, value);
  return `#/${view}?${params}`;
}
