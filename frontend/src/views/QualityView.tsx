import { useState } from "react";
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
  const [source, setSource] = useState(false);
  return (
    <section className="glass view-panel quality-panel">
      <div className="section-heading">
        <div>
          <h1>Calidad de datos</h1>
          <p>Incidencias de la selección · registros conservados</p>
        </div>
        <button className="primary" disabled={exporting} onClick={onExport}>
          {exporting ? "Preparando…" : "Exportar incidencias CSV"}
        </button>
      </div>
      <div className="quality-navigation">
        <div className="panel-tabs" aria-label="Controles de calidad">
          <button aria-pressed={!source} onClick={() => setSource(false)}>
            Incidencias
          </button>
          <button aria-pressed={source} onClick={() => setSource(true)}>
            Fuente completa
          </button>
        </div>
        {!source && (
          <label className="inline-label">
            Incidencia
            <select
              value={request.issue}
              onChange={(event) =>
                onRequest({ issue: event.target.value, recordPage: 1 })
              }
            >
              <option value="all">Todas las incidencias</option>
              {Object.entries(issueLabels).map(([key, label]) => (
                <option value={key} key={key}>
                  {label} ·{" "}
                  {integer(
                    result.summary.quality[key as keyof typeof issueLabels],
                  )}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!source ? (
        <div className="quality-records">
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
          <Records
            rows={result.records}
            pageSize={request.recordPageSize || 1}
            onCapacity={(recordPageSize) =>
              onRequest({ recordPageSize, recordPage: 1 })
            }
          />
          <Pager
            page={request.recordPage}
            count={result.recordCount}
            pageSize={request.recordPageSize}
            onChange={(recordPage) => onRequest({ recordPage })}
          />
        </div>
      ) : (
        <div className="source-pane">
          <h2>Fuente completa</h2>
          <p>Controles globales del snapshot, independientes de los filtros.</p>
          <div className="source-checks">
            <span>
              <strong>
                {integer(overview.sourceQuality.unmatchedCampaignRows)}
              </strong>{" "}
              cruces de campaña fallidos
            </span>
            <span>
              <strong>
                {integer(overview.sourceQuality.unmatchedFolderRows)}
              </strong>{" "}
              cruces de folder fallidos
            </span>
            <span>
              <strong>
                {integer(overview.sourceQuality.duplicateCampaignCatalogKeys)}
              </strong>{" "}
              claves duplicadas en catálogo
            </span>
            <button onClick={onUnknown}>
              <strong>
                {integer(overview.sourceQuality.rowsWithoutSentDate)}
              </strong>{" "}
              registros sin fecha · consultar
            </button>
          </div>
          <p>
            Una fila puede presentar varias incidencias. Los conteos por
            incidencia no se suman.
          </p>
        </div>
      )}
    </section>
  );
}
