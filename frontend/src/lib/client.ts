import { csv, query, validateDetail } from "./analysis.ts";
import type {
  DashboardData,
  Filters,
  OverviewData,
  Query,
  QueryResult,
} from "../types.ts";
let worker: Worker | undefined,
  failed = false,
  nextId = 0,
  detail: Promise<DashboardData> | undefined;
const pending = new Map<
  number,
  { resolve: (result: unknown) => void; reject: (error: Error) => void }
>();
async function fallback(
  overview: OverviewData,
  request?: Query,
  filters?: Filters,
  issue?: string,
) {
  detail ??= fetch(import.meta.env.BASE_URL + "data/dashboard.json")
    .then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar el detalle");
      return response.json();
    })
    .catch((error) => {
      detail = undefined;
      throw error;
    });
  const data = await detail;
  validateDetail(data, overview);
  return request
    ? query(data.records, request)
    : csv(data.records, filters!, issue);
}
function run(
  overview: OverviewData,
  request?: Query,
  filters?: Filters,
  issue?: string,
): Promise<unknown> {
  if (!failed && !worker)
    try {
      worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = ({ data }) => {
        const task = pending.get(data.id);
        if (!task) return;
        pending.delete(data.id);
        if (data.error) task.reject(new Error(data.error));
        else task.resolve(data.result);
      };
      worker.onerror = () => {
        failed = true;
        worker?.terminate();
        worker = undefined;
        for (const task of pending.values())
          task.reject(new Error("WORKER_UNAVAILABLE"));
        pending.clear();
      };
    } catch {
      failed = true;
    }
  if (!worker) return fallback(overview, request, filters, issue);
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ id, overview, query: request, filters, issue });
  }).catch((error) => {
    if (error.message === "WORKER_UNAVAILABLE")
      return fallback(overview, request, filters, issue);
    throw error;
  });
}
export const runQuery = (overview: OverviewData, request: Query) =>
  run(overview, request) as Promise<QueryResult>;
export const exportCsv = (
  overview: OverviewData,
  filters: Filters,
  issue?: string,
) => run(overview, undefined, filters, issue) as Promise<string>;
