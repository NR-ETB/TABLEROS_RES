import { lazy, Suspense, useEffect, useState } from "react";
import type {
  Filters,
  OverviewData,
  Period,
  Query,
  QueryResult,
  View,
} from "./types";
import { defaultFilters, issueLabels, periodDates } from "./lib/analysis";
import { makeHash, readHash } from "./lib/navigation";
import { exportCsv, runQuery } from "./lib/client";
import { integer, pct } from "./lib/numbers";
import Overview from "./components/Overview";
import Dialog from "./components/Dialog";
import Records, { Pager } from "./components/Records";
const CampaignsView = lazy(() => import("./views/CampaignsView"));
const QualityView = lazy(() => import("./views/QualityView"));
const periodLabels: Record<Period, string> = {
  all: "Histórico",
  last30: "Últimos 30 días",
  last90: "Últimos 90 días",
  latestYear: "Año disponible",
  custom: "Personalizado",
};
const initialQuery = {
  page: 1,
  sort: "sends" as const,
  ascending: false,
  selected: null as string | null,
  recordPage: 1,
  issue: "all",
};
function Advanced({
  overview,
  filters,
  onApply,
  onClose,
}: {
  overview: OverviewData;
  filters: Filters;
  onApply: (filters: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(filters);
  const set = (key: keyof Filters, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  return (
    <Dialog title="Más filtros" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onApply(draft);
          onClose();
        }}
      >
        <div className="filter-grid">
          <label>
            Período
            <select
              value={draft.period}
              onChange={(event) => {
                const period = event.target.value as Period;
                const [from, to] =
                  period === "custom"
                    ? [draft.from, draft.to]
                    : periodDates(overview.meta, period);
                setDraft({ ...draft, period, from, to });
              }}
            >
              {Object.entries(periodLabels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input
              type="date"
              required
              value={draft.from}
              max={draft.to}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  from: event.target.value,
                  period: "custom",
                })
              }
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              required
              value={draft.to}
              min={draft.from}
              onChange={(event) =>
                setDraft({ ...draft, to: event.target.value, period: "custom" })
              }
            />
          </label>
          {(
            [
              ["folder", "folders", "Folder"],
              ["program", "programs", "Programa"],
              ["type", "types", "Tipo"],
              ["status", "statuses", "Estado"],
            ] as const
          ).map(([key, options, label]) => (
            <label key={key}>
              {label}
              <select
                value={draft[key]}
                onChange={(event) => set(key, event.target.value)}
              >
                <option value="">Todos</option>
                <option value="Sin dato">Sin dato</option>
                {overview.filters[options].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Calidad
            <select
              value={draft.quality}
              onChange={(event) => set("quality", event.target.value)}
            >
              <option value="">Todos los registros</option>
              <option value="fullMatch">Cruces completos</option>
              <option value="anomalyRows">Con incidencias</option>
              {Object.entries(issueLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p>
          Períodos rápidos terminan en {overview.meta.latestSentDate}. Fechas
          desconocidas se consultan desde Calidad.
        </p>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" type="submit">
            Aplicar
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export default function App() {
  const [overview, setOverview] = useState<OverviewData>(),
    [error, setError] = useState("");
  const [state, setState] = useState<{ view: View; filters: Filters }>(),
    [search, setSearch] = useState("");
  const [queryState, setQueryState] =
    useState<Omit<Query, "filters">>(initialQuery);
  const [answer, setAnswer] = useState<{
      key: string;
      filtersKey: string;
      selected: string | null;
      data: QueryResult;
    }>(),
    [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<"filters" | "source" | null>(null),
    [exporting, setExporting] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(import.meta.env.BASE_URL + "data/overview.json")
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el resumen");
        return response.json();
      })
      .then((data: OverviewData) => {
        if (
          data.schemaVersion !== 1 ||
          !data.summaries?.all ||
          !data.meta?.dataHash
        )
          throw new Error("Contrato de datos incompatible");
        if (active) {
          setOverview(data);
          const next = readHash(location.hash, data);
          setState(next);
          setSearch(next.filters.campaign);
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!overview) return;
    const sync = () => {
      const next = readHash(location.hash, overview);
      setState(next);
      setSearch(next.filters.campaign);
      setQueryState(initialQuery);
      setError("");
    };
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, [overview]);
  function navigate(view: View, filters: Filters) {
    const hash = makeHash(view, filters);
    if (location.hash !== hash) history.pushState(null, "", hash);
    setState({ view, filters });
    setSearch(filters.campaign);
    setQueryState(initialQuery);
    setError("");
  }
  useEffect(() => {
    if (!state || search === state.filters.campaign) return;
    const timer = setTimeout(
      () =>
        navigate(state.view, {
          ...state.filters,
          campaign: search,
          campaignExact: "",
        }),
      150,
    );
    return () => clearTimeout(timer);
  }, [search, state]);
  const filters = state?.filters;
  const simple =
    !!filters &&
    filters.period !== "custom" &&
    ![
      filters.purpose,
      filters.folder,
      filters.program,
      filters.type,
      filters.status,
      filters.campaign,
      filters.campaignExact,
      filters.quality,
    ].some(Boolean);
  const request = filters ? { ...queryState, filters } : undefined;
  const requestKey = JSON.stringify(request);
  const needsDetail = !!state && (!simple || state.view !== "resumen");
  useEffect(() => {
    if (!overview || !needsDetail || !request) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    runQuery(overview, request)
      .then((data) => {
        if (active) {
          setAnswer({
            key: requestKey,
            filtersKey: JSON.stringify(request.filters),
            selected: request.selected,
            data,
          });
          setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setError(error.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [overview, requestKey, needsDetail]);
  const result =
    answer && answer.filtersKey === JSON.stringify(filters)
      ? answer.data
      : undefined;
  const summary =
    overview && filters
      ? simple
        ? overview.summaries[filters.period as Exclude<Period, "custom">]
        : result?.summary
      : undefined;
  async function download(issue?: string) {
    if (!overview || !filters) return;
    setExporting(true);
    try {
      const content = await exportCsv(overview, filters, issue);
      const url = URL.createObjectURL(
        new Blob([content], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `responsys-1.0A-${state!.view}-${filters.from}-${filters.to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  }
  const failure =
    error === "DATA_CHANGED"
      ? "La fuente cambió durante la consulta. Recarga para usar un corte consistente."
      : error;
  if (!overview || !state || !filters)
    return (
      <main className="startup glass" aria-live="polite">
        <h1>
          ETB · Responsys <small>1.0A</small>
        </h1>
        <p>{failure || "Cargando rendimiento de campañas…"}</p>
        {failure && (
          <button className="primary" onClick={() => location.reload()}>
            Reintentar
          </button>
        )}
      </main>
    );
  const patch = (next: Partial<Filters>, view = state.view) =>
    navigate(view, { ...filters, ...next });
  const unknown = () => {
    patch({ quality: "withoutDate" }, "calidad");
    setQueryState({ ...initialQuery, issue: "withoutDate" });
  };
  const activeFilters = (
    [
      "purpose",
      "folder",
      "program",
      "type",
      "status",
      "campaign",
      "campaignExact",
      "quality",
    ] as const
  ).filter((key) => filters[key]);
  const synced = new Date(overview.meta.generatedAtUtc),
    old = Date.now() - synced.getTime() > 48 * 3600000;
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href={makeHash("resumen", filters)}
          onClick={(event) => {
            event.preventDefault();
            navigate("resumen", filters);
          }}
        >
          <span>
            ETB <i>·</i> Responsys <small>1.0A</small>
          </span>
          <span>Rendimiento de campañas</span>
        </a>
        <nav aria-label="Vistas del tablero">
          {(
            [
              ["resumen", "Resumen"],
              ["campanas", "Campañas"],
              ["calidad", "Calidad"],
            ] as const
          ).map(([view, label]) => (
            <button
              key={view}
              aria-current={state.view === view ? "page" : undefined}
              onClick={() => navigate(view, filters)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button className="source-button" onClick={() => setDialog("source")}>
          <span>
            {overview.meta.sourceMode === "google"
              ? "Google Sheets"
              : "Snapshot"}{" "}
            · corte {overview.meta.latestSentDate}
          </span>
          <small>
            {old ? "ⓘ Sincronización antigua" : "Ver fuente y sincronización"}{" "}
            ↗
          </small>
        </button>
      </header>
      <main>
        {state.view === "resumen" && (
          <h1 className="sr-only">Rendimiento de campañas</h1>
        )}
        <section className="glass toolbar" aria-label="Filtros principales">
          <label>
            Período
            <select
              value={filters.period}
              onChange={(event) => {
                const period = event.target.value as Period;
                if (period === "custom") setDialog("filters");
                else {
                  const [from, to] = periodDates(overview.meta, period);
                  patch({ period, from, to });
                }
              }}
            >
              {Object.entries(periodLabels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Propósito
            <select
              value={filters.purpose}
              onChange={(event) => patch({ purpose: event.target.value })}
            >
              <option value="">Todos los propósitos</option>
              <option value="Sin dato">Sin dato</option>
              {overview.filters.purposes.map((purpose) => (
                <option key={purpose}>{purpose}</option>
              ))}
            </select>
          </label>
          <label className="search-field">
            Buscar campaña
            <input
              type="search"
              placeholder="Nombre de campaña…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button onClick={() => setDialog("filters")}>
            Más filtros <span aria-hidden="true">☷</span>
          </button>
        </section>
        {(!!activeFilters.length || filters.period === "custom") && (
          <div className="filter-chips" aria-label="Filtros activos">
            {filters.period === "custom" && (
              <button
                onClick={() => {
                  const [from, to] = periodDates(overview.meta, "all");
                  patch({ period: "all", from, to });
                }}
              >
                {filters.from} al {filters.to} <span aria-hidden="true">×</span>
              </button>
            )}
            {activeFilters.map((key) => (
              <button
                key={key}
                onClick={() => patch({ [key]: "" })}
                title={`Quitar ${key}: ${filters[key]}`}
              >
                {key === "quality"
                  ? issueLabels[filters[key] as keyof typeof issueLabels] ||
                    filters[key]
                  : filters[key]}{" "}
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button
              onClick={() =>
                navigate(state.view, defaultFilters(overview.meta))
              }
            >
              Limpiar
            </button>
          </div>
        )}
        {failure && (
          <div className="load-error" role="alert">
            {failure}
            <button onClick={() => location.reload()}>Reintentar</button>
          </div>
        )}
        <div aria-live="polite" className="loading-status">
          {loading ? "Consultando datos…" : ""}
        </div>
        {state.view === "resumen" && summary && (
          <Overview
            summary={summary}
            onCampaign={(campaignExact) =>
              patch({ campaignExact, campaign: "" }, "campanas")
            }
            onFolder={(folder) => patch({ folder })}
            onPurpose={(purpose) => patch({ purpose })}
            onQuality={() => navigate("calidad", filters)}
          />
        )}{" "}
        {((state.view !== "resumen" && !result) ||
          (state.view === "resumen" && !summary)) &&
          !failure && (
            <div className="glass loading-panel" role="status">
              Cargando selección…
            </div>
          )}
        <Suspense
          fallback={<div className="glass loading-panel">Abriendo vista…</div>}
        >
          {result && request && state.view === "campanas" && (
            <CampaignsView
              result={result}
              request={request}
              onRequest={(next) =>
                setQueryState((current) => ({ ...current, ...next }))
              }
              onSelect={(selected) =>
                setQueryState((current) => ({
                  ...current,
                  selected,
                  recordPage: 1,
                }))
              }
              onExport={() => download()}
              exporting={exporting}
            />
          )}{" "}
          {result && request && state.view === "calidad" && (
            <QualityView
              overview={overview}
              result={result}
              request={request}
              onRequest={(next) => {
                if (next.issue === "withoutDate") {
                  unknown();
                } else if (
                  filters.quality === "withoutDate" &&
                  next.issue &&
                  next.issue !== "withoutDate"
                ) {
                  patch({ quality: "" });
                  setQueryState({ ...initialQuery, ...next });
                } else setQueryState((current) => ({ ...current, ...next }));
              }}
              onUnknown={unknown}
              onExport={() => download(queryState.issue)}
              exporting={exporting}
            />
          )}
        </Suspense>
      </main>
      {dialog === "filters" && (
        <Advanced
          overview={overview}
          filters={filters}
          onApply={(next) => navigate(state.view, next)}
          onClose={() => setDialog(null)}
        />
      )}{" "}
      {dialog === "source" && (
        <Dialog title="Fuente y corte de datos" onClose={() => setDialog(null)}>
          <dl className="source-info">
            <dt>Fuente</dt>
            <dd>
              Google Sheets ·{" "}
              {overview.meta.sourceMode === "google"
                ? "Sincronización lectora"
                : "Snapshot versionado (sin conexión viva)"}
            </dd>
            <dt>Período disponible</dt>
            <dd>
              {overview.meta.earliestSentDate} al {overview.meta.latestSentDate}
            </dd>
            <dt>Última sincronización</dt>
            <dd>
              {synced.toLocaleString("es-CO", { timeZone: "America/Bogota" })}{" "}
              (Bogotá){old ? " · antigua: más de 48 horas" : ""}
            </dd>
            <dt>Registros</dt>
            <dd>{integer(overview.meta.rowCount)}</dd>
            <dt>Versión de datos</dt>
            <dd>{overview.meta.dataHash}</dd>
          </dl>
          <p>
            Se conservan todas las filas originales. Aperturas y clics únicos
            pueden repetirse entre registros de una campaña.
          </p>
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://docs.google.com/spreadsheets/d/${overview.meta.spreadsheetId}/edit`}
          >
            Abrir fuente en Google Sheets ↗
          </a>
        </Dialog>
      )}{" "}
      {queryState.selected !== null && state.view === "campanas" && (
        <Dialog
          title={queryState.selected}
          wide
          onClose={() =>
            setQueryState((current) => ({
              ...current,
              selected: null,
              recordPage: 1,
            }))
          }
        >
          {result?.detail && answer?.selected === queryState.selected ? (
            <>
              <div className="detail-kpis">
                <span>
                  Envíos <strong>{integer(result.detail.sends)}</strong>
                </span>
                <span>
                  Entrega{" "}
                  <strong>
                    {result.detail.sends
                      ? pct(
                          (result.detail.delivered / result.detail.sends) * 100,
                        )
                      : "N/D"}
                  </strong>
                </span>
                <span>
                  Aperturas <strong>{integer(result.detail.opens)}</strong>
                </span>
                <span>
                  Clics <strong>{integer(result.detail.clicks)}</strong>
                </span>
                <span>
                  Rebotes <strong>{integer(result.detail.bounces)}</strong>
                </span>
              </div>
              <Records rows={result.records} />
              <Pager
                page={queryState.recordPage}
                count={result.recordCount}
                onChange={(recordPage) =>
                  setQueryState((current) => ({ ...current, recordPage }))
                }
              />
            </>
          ) : (
            <p role="status">Consultando registros…</p>
          )}
        </Dialog>
      )}
    </div>
  );
}
