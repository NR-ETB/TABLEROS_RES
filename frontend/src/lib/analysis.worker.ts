import { csv, query, validateDetail } from "./analysis.ts";
import type {
  DashboardData,
  Filters,
  OverviewData,
  Query,
  ReportRequest,
} from "../types.ts";
import { report } from "./reports.ts";
let detail: Promise<DashboardData> | undefined;
onmessage = async ({
  data,
}: MessageEvent<{
  id: number;
  overview: OverviewData;
  query?: Query;
  filters?: Filters;
  issue?: string;
  report?: ReportRequest;
}>) => {
  try {
    detail ??= fetch(
      import.meta.env.BASE_URL +
        "data/dashboard.json?cut=" +
        encodeURIComponent(data.overview.meta.dataHash),
    ).then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar el detalle");
      return response.json();
    });
    const dataset = await detail;
    validateDetail(dataset, data.overview);
    postMessage({
      id: data.id,
      result: data.report
        ? report(dataset.records, data.overview, data.report, dataset.catalog)
        : data.query
          ? query(dataset.records, data.query, dataset.catalog)
          : csv(dataset.records, data.filters!, data.issue, dataset.catalog),
    });
  } catch (error) {
    detail = undefined;
    postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
