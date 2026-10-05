import type { OverviewData, Query, QueryResult } from "../types";
import { issueLabels } from "../lib/analysis";
import { integer } from "../lib/numbers";
import Records, { Pager } from "../components/Records";
export default function QualityView({
  overview,
  result,
  request,
  onRequest,
  onUnknown,
  onExport,
  exporting,
}: {
  overview: OverviewData;
  result: QueryResult;
  request: Query;
  onRequest: (next: Partial<Query>) => void;
  onUnknown: () => void;
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <div className="quality-layout">
      <section className="glass view-panel">
        <div className="section-heading">
          <div>
            <h1>Calidad de datos</h1>
            <p>
              Incidencias de la selección · registros conservados; ninguna
              corrección automática
            </p>
          </div>
          <button className="primary" disabled={exporting} onClick={onExport}>
            {exporting ? "Preparando…" : "Exportar incidencias CSV"}
          </button>
        </div>
        <div className="issue-grid">
          {Object.entries(issueLabels).map(([key, label]) => (
            <button
              className={request.issue === key ? "active" : ""}
              key={key}
              onClick={() =>
                key === "withoutDate"
                  ? onUnknown()
                  : onRequest({ issue: key, recordPage: 1 })
              }
            >
              <span>{label}</span>
              <strong>
                {integer(
                  result.summary.quality[key as keyof typeof issueLabels],
                )}
              </strong>
            </button>
          ))}
        </div>
        <label className="inline-label">
          Incidencia
          <select
            value={request.issue}
            onChange={(event) =>
              onRequest({ issue: event.target.value, recordPage: 1 })
            }
          >
            <option value="all">
              Todas las incidencias (sin duplicar registros)
            </option>
            {Object.entries(issueLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Records rows={result.records} />
        <Pager
          page={request.recordPage}
          count={result.recordCount}
          onChange={(recordPage) => onRequest({ recordPage })}
        />
      </section>
      <section className="glass view-panel">
        <h2>Fuente completa</h2>
        <p>Controles globales del snapshot, independientes de los filtros.</p>
        <div className="source-checks">
          <span>
            {integer(overview.sourceQuality.unmatchedCampaignRows)} cruces de
            campaña fallidos
          </span>
          <span>
            {integer(overview.sourceQuality.unmatchedFolderRows)} cruces de
            folder fallidos
          </span>
          <span>
            {integer(overview.sourceQuality.duplicateCampaignCatalogKeys)}{" "}
            claves duplicadas en catálogo
          </span>
          <button onClick={onUnknown}>
            {integer(overview.sourceQuality.rowsWithoutSentDate)} registros sin
            fecha · consultar
          </button>
        </div>
        <p>
          Una fila puede presentar varias incidencias. Los conteos por
          incidencia no se suman.
        </p>
      </section>
    </div>
  );
}
