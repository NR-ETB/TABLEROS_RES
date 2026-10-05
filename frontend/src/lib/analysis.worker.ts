import { csv, query, validateDetail } from "./analysis.ts";
import type { DashboardData, Filters, OverviewData, Query } from "../types.ts";
let detail: Promise<DashboardData> | undefined;
onmessage = async ({
  data,
}: MessageEvent<{
  id: number;
  overview: OverviewData;
  query?: Query;
  filters?: Filters;
  issue?: string;
}>) => {
  try {
    detail ??= fetch(import.meta.env.BASE_URL + "data/dashboard.json").then(
      (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el detalle");
        return response.json();
      },
    );
    const dataset = await detail;
    validateDetail(dataset, data.overview);
    postMessage({
      id: data.id,
      result: data.query
        ? query(dataset.records, data.query)
        : csv(dataset.records, data.filters!, data.issue),
    });
  } catch (error) {
    detail = undefined;
    postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
