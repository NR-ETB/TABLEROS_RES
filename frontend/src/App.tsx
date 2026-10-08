import { lazy, Suspense, useEffect, useState } from "react";
import type {
  Filters,
  OverviewData,
  Period,
  Query,
  QueryResult,
  View,
} from "./types";
import {
  defaultFilters,
  issueLabels,
  periodDates,
  filterLabels,
  filterValue,
} from "./lib/analysis";
import { makeHash, readHash } from "./lib/navigation";
import { exportCsv, exportReport, runQuery } from "./lib/client";
import { integer } from "./lib/numbers";
import Overview from "./components/Overview";
import Dialog from "./components/Dialog";
import CampaignDetail from "./components/CampaignDetail";
import { applyTheme, initialTheme, type Theme } from "./lib/theme";
import { rangeError } from "./lib/reports";
import { saveDownload } from "./lib/download";
const Reports = lazy(() => import("./components/Reports"));
const CampaignsView = lazy(() => import("./views/CampaignsView"));
const InventoryView = lazy(() => import("./views/InventoryView"));
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
  pageSize: 1,
  recordPageSize: 1,
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
  const [fieldPage, setFieldPage] = useState(1);
  const [tab, setTab] = useState("fechas"),
    [invalid, setInvalid] = useState("");
  const set = (key: keyof Filters, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  return (
    <Dialog title="Más filtros" onClose={onClose} className="filter-dialog">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const dateError = rangeError(draft.from, draft.to);
          if (dateError) {
            setInvalid(dateError);
            setTab("fechas");
            setFieldPage(1);
            return;
          }
          if (
            draft.sourceYear !== "" &&
            (!/^\d+$/.test(draft.sourceYear) ||
              !Number.isSafeInteger(Number(draft.sourceYear)))
          ) {
            setInvalid("El año de origen debe ser un número entero positivo.");
            setTab("categorias");
            setFieldPage(1);
            return;
          }
          if (
            [draft.minSends, draft.maxSends].some(
              (value) =>
                value !== "" &&
                (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))),
            ) ||
            (draft.minSends !== "" &&
              draft.maxSends !== "" &&
              Number(draft.minSends) > Number(draft.maxSends))
          ) {
            setInvalid(
              "Usa números enteros positivos o cero. El mínimo no debe superar el máximo.",
            );
            setTab("actividad");
            setFieldPage(1);
            return;
          }
          onApply(draft);
          onClose();
        }}
      >
        <div className="panel-tabs filter-tabs" aria-label="Grupos de filtros">
          {[
            ["fechas", "Período"],
            ["campana", "Campaña"],
            ["categorias", "Categorías"],
            ["actividad", "Actividad"],
            ["control", "Control"],
          ].map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={tab === key}
              onClick={() => {
                setTab(key);
                setFieldPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className="filter-grid"
          data-page={fieldPage}
          hidden={tab !== "fechas"}
        >
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
              onInput={(event) => {
                const value = event.currentTarget.value;
                const key = event.currentTarget.name;
                setDraft((current) => ({
                  ...current,
                  [key]: value,
                  period: "custom",
                }));
              }}
              required
              name="from"
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
              onInput={(event) => {
                const value = event.currentTarget.value;
                const key = event.currentTarget.name;
                setDraft((current) => ({
                  ...current,
                  [key]: value,
                  period: "custom",
                }));
              }}
              required
              name="to"
              value={draft.to}
              min={draft.from}
              onChange={(event) =>
                setDraft({ ...draft, to: event.target.value, period: "custom" })
              }
            />
          </label>
          <label>
            Propósito
            <select
              value={draft.purpose}
              onChange={(event) => set("purpose", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="Sin dato">Sin dato</option>
              {overview.filters.purposes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <div
          className="filter-grid"
          data-page={fieldPage}
          hidden={tab !== "campana"}
        >
          <label>
            Buscar campaña
            <input
              type="search"
              value={draft.campaign}
              placeholder="Palabras, en cualquier orden…"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  campaign: event.target.value,
                  campaignExact: "",
                })
              }
            />
          </label>
          <label>
            Buscar en
            <select
              value={draft.searchIn}
              onChange={(event) => set("searchIn", event.target.value)}
            >
              <option value="">Nombre de campaña</option>
              <option value="all">Todos los campos e ID del catálogo</option>
            </select>
          </label>
          <label>
            Asunto contiene
            <input
              type="search"
              value={draft.subject}
              placeholder="Palabras del asunto"
              onChange={(event) => set("subject", event.target.value)}
            />
          </label>
          <label>
            Remitente contiene
            <input
              type="search"
              value={draft.sender}
              placeholder="Nombre o correo"
              onChange={(event) => set("sender", event.target.value)}
            />
          </label>
        </div>
        <div
          className="filter-grid"
          data-page={fieldPage}
          hidden={tab !== "categorias"}
        >
          <label>
            Lista contiene
            <input
              type="search"
              placeholder="Nombre o parte de la lista"
              value={draft.list}
              onChange={(e) => set("list", e.target.value)}
            />
          </label>
          <label>
            Año de origen
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Todos"
              value={draft.sourceYear}
              onChange={(e) => set("sourceYear", e.target.value)}
            />
          </label>
          {(
            [
              ["folder", "folders", "Folder"],
              ["program", "programs", "Programa"],
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
        </div>
        <div
          className="filter-grid"
          data-page={fieldPage}
          hidden={tab !== "actividad"}
        >
          <label>
            Envíos mínimos por registro
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Sin mínimo"
              value={draft.minSends}
              onChange={(e) => set("minSends", e.target.value)}
            />
          </label>
          <label>
            Envíos máximos por registro
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Sin máximo"
              value={draft.maxSends}
              onChange={(e) => set("maxSends", e.target.value)}
            />
          </label>
          <label className="full-field">
            Actividad del registro
            <select
              value={draft.activity}
              onChange={(e) => set("activity", e.target.value)}
            >
              <option value="">Toda la actividad</option>
              <option value="opens">Con aperturas</option>
              <option value="clicks">Con clics</option>
              <option value="bounces">Con rebotes</option>
              <option value="none">Sin aperturas, clics ni rebotes</option>
            </select>
          </label>
        </div>
        <div
          className="filter-grid"
          data-page={fieldPage}
          hidden={tab !== "control"}
        >
          {(
            [
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
          <label>
            Actividad del catálogo (Inventario)
            <select
              value={draft.catalogPresence}
              onChange={(event) => set("catalogPresence", event.target.value)}
            >
              <option value="">Todas las fichas</option>
              <option value="with">Con registros en el corte</option>
              <option value="without">Sin registros en el corte</option>
            </select>
          </label>
        </div>
        {
          <div className="filter-page">
            <small>Campos {fieldPage} / 2</small>
            <button
              type="button"
              onClick={() => setFieldPage(fieldPage === 1 ? 2 : 1)}
            >
              {fieldPage === 1 ? "Más campos" : "Campos anteriores"}
            </button>
          </div>
        }
        <p className="filter-note" role={invalid ? "alert" : undefined}>
          {invalid ? (
            invalid
          ) : (
            <>
              Períodos rápidos terminan en {overview.meta.latestSentDate}.
              Búsqueda por palabras, sin distinguir acentos.{" "}
              {draft.campaignExact && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => set("campaignExact", "")}
                >
                  Quitar campaña exacta
                </button>
              )}
            </>
          )}
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            onClick={() => {
              setDraft(defaultFilters(overview.meta));
              setInvalid("");
            }}
          >
            Limpiar
          </button>
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
  const [theme, setTheme] = useState<Theme>(initialTheme);
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
      catalogMode: boolean;
      data: QueryResult;
    }>(),
    [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<"filters" | "source" | "reports" | null>(
      null,
    ),
    [exporting, setExporting] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(import.meta.env.BASE_URL + "data/overview.json", {
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el resumen");
        return response.json();
      })
      .then((data: OverviewData) => {
        if (
          data.schemaVersion !== 2 ||
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
    if (view !== "inventario") filters = { ...filters, catalogPresence: "" };
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
      filters.list,
      filters.sourceYear,
      filters.minSends,
      filters.maxSends,
      filters.activity,
      filters.subject,
      filters.sender,
      filters.searchIn,
      filters.catalogPresence,
    ].some(Boolean);
  const request = filters
    ? { ...queryState, filters, catalogMode: state?.view === "inventario" }
    : undefined;
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
            catalogMode: request.catalogMode,
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
    answer &&
    answer.filtersKey === JSON.stringify(filters) &&
    answer.catalogMode === (state?.view === "inventario")
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
      const content =
        state?.view === "inventario"
          ? (await exportReport(overview, { filters, format: "inventory" }))
              .content
          : await exportCsv(overview, filters, issue);
      saveDownload(
        content,
        `responsys-1.0A-${state!.view}-${filters.from}-${filters.to}.csv`,
        "text/csv;charset=utf-8",
      );
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
      "list",
      "sourceYear",
      "minSends",
      "maxSends",
      "activity",
      "subject",
      "sender",
      "searchIn",
      "catalogPresence",
    ] as const
  ).filter((key) => filters[key]);
  const synced = new Date(overview.meta.generatedAtUtc),
    old = Date.now() - synced.getTime() > 48 * 3600000;
  return (
    <div className="app-shell" data-view={state.view}>
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
              aria-current={
                state.view === view ||
                (state.view === "inventario" && view === "campanas")
                  ? "page"
                  : undefined
              }
              aria-label={label}
              onClick={() => navigate(view, filters)}
            >
              {label}
              {view === "calidad" && (
                <small className="nav-count" aria-hidden="true">
                  {integer(
                    (summary || overview.summaries.all).quality.anomalyRows,
                  )}
                </small>
              )}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="reports-button"
            onClick={() => setDialog("reports")}
            aria-label="Reportes por fecha"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />
            </svg>
            <span>Reportes</span>
          </button>
          <button
            className="source-button"
            aria-label={`Fuente y corte de datos: ${overview.meta.sourceMode === "google" ? "Google Sheets" : "Snapshot"}, ${overview.meta.latestSentDate}`}
            onClick={() => setDialog("source")}
          >
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
          <button
            className="theme-toggle"
            aria-label={
              theme === "light" ? "Activar modo oscuro" : "Activar modo claro"
            }
            aria-pressed={theme === "dark"}
            onClick={() => {
              const next = theme === "light" ? "dark" : "light";
              applyTheme(next);
              setTheme(next);
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              {theme === "light" ? (
                <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />
              ) : (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
                </>
              )}
            </svg>
          </button>
          <button
            className="compact-filter-button"
            aria-label="Abrir filtros"
            onClick={() => setDialog("filters")}
          >
            ☷
            {(activeFilters.length > 0 || filters.period === "custom") && (
              <small aria-hidden="true">
                {activeFilters.length + Number(filters.period === "custom")}
              </small>
            )}
          </button>
        </div>
      </header>
      <main className="app-main">
        {state.view === "resumen" && (
          <h1 className="sr-only">Rendimiento de campañas</h1>
        )}
        <section className="glass toolbar" aria-label="Filtros principales">
          <label className="period-field">
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
          <label className="purpose-field">
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
            {activeFilters.slice(0, 2).map((key) => (
              <button
                className="filter-chip"
                key={key}
                onClick={() => patch({ [key]: "" })}
                title={`${filterLabels[key]}: ${filterValue(key, filters[key])}`}
                aria-label={`Quitar filtro ${filterLabels[key]}: ${filterValue(key, filters[key])}`}
              >
                <span>
                  {filterLabels[key]}: {filterValue(key, filters[key])}
                </span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button
              onClick={() => setDialog("filters")}
              title={activeFilters
                .map(
                  (key) =>
                    `${filterLabels[key]}: ${filterValue(key, filters[key])}`,
                )
                .join(" · ")}
            >
              {activeFilters.length + Number(filters.period === "custom")}{" "}
              filtros activos · Editar
            </button>
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
              onInventory={() => navigate("inventario", filters)}
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
          {result && request && state.view === "inventario" && (
            <InventoryView
              result={result}
              request={request}
              onRequest={(next) =>
                setQueryState((current) => ({ ...current, ...next }))
              }
              onScope={(next) => patch(next)}
              onPerformance={(name) =>
                navigate("campanas", {
                  ...filters,
                  campaignExact: name || "",
                  campaign: "",
                  catalogPresence: "",
                })
              }
              onExport={() => download()}
              exporting={exporting}
            />
          )}
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
          onApply={(next) =>
            navigate(next.catalogPresence ? "inventario" : state.view, next)
          }
          onClose={() => setDialog(null)}
        />
      )}{" "}
      {dialog === "reports" && (
        <Suspense
          fallback={
            <Dialog title="Reportes por fecha" onClose={() => setDialog(null)}>
              <p role="status">Abriendo reportes…</p>
            </Dialog>
          }
        >
          <Reports
            overview={overview}
            filters={filters}
            issue={state.view === "calidad" ? queryState.issue : undefined}
            onClose={() => setDialog(null)}
          />
        </Suspense>
      )}
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
          className="campaign-detail-dialog"
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
              <CampaignDetail
                result={result}
                request={request!}
                onRequest={(next) =>
                  setQueryState((current) => ({ ...current, ...next }))
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
