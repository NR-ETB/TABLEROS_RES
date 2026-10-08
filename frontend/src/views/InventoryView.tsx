import { useState } from "react";
import type { CatalogEntry, Filters, Query, QueryResult } from "../types";
import Dialog from "../components/Dialog";
import FieldPages from "../components/FieldPages";
import { Pager } from "../components/Records";
import { usePageCapacity } from "../lib/usePageCapacity";
import { integer } from "../lib/numbers";
// Intent: find a complete source entry. Hierarchy: name, subject, activity.
// Shared ETB tokens, quiet borders, Segoe UI, 16 px panels / 44 px controls.
export default function InventoryView({
  result,
  request,
  onRequest,
  onScope,
  onPerformance,
  onExport,
  exporting,
}: {
  result: QueryResult;
  request: Query;
  onRequest: (next: Partial<Query>) => void;
  onScope: (next: Partial<Filters>) => void;
  onPerformance: (name?: string) => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const [selected, setSelected] = useState<
    (CatalogEntry & { activity: number }) | null
  >(null);
  const table = usePageCapacity(request.pageSize || 1, (size) =>
    onRequest({ pageSize: size, page: 1 }),
  );
  return (
    <section className="glass view-panel inventory-panel">
      <div className="section-heading">
        <div>
          <h1>Inventario</h1>
          <p>
            {integer(result.inventoryCount)} fichas · campos originales de
            Campañas Vigentes
          </p>
        </div>
        <button className="primary" disabled={exporting} onClick={onExport}>
          {exporting ? "Preparando…" : "Catálogo CSV"}
        </button>
      </div>
      <div className="inventory-controls">
        <div className="panel-tabs">
          <button onClick={() => onPerformance()}>Rendimiento</button>
          <button aria-pressed>Inventario</button>
        </div>
        <label>
          Actividad en el corte
          <select
            aria-label="Actividad del catálogo"
            value={request.filters.catalogPresence}
            onChange={(event) =>
              onScope({ catalogPresence: event.target.value })
            }
          >
            <option value="">Todas las fichas</option>
            <option value="with">Con registros</option>
            <option value="without">Sin registros</option>
          </select>
        </label>
      </div>
      <p className="inventory-note">
        Las fechas y filtros de registros determinan la actividad. Las fichas se
        filtran por nombre, asunto, remitente, lista, folder, propósito, tipo y
        estado. Duplicados conservados.
      </p>
      <div
        className="inventory-coverage"
        aria-label="Actividad de las fichas filtradas"
      >
        <button
          onClick={() =>
            onScope({
              catalogPresence:
                request.filters.catalogPresence === "with" ? "" : "with",
            })
          }
        >
          <span
            style={{
              width: `${result.inventoryCount ? (100 * result.inventoryCoverage.withRecords) / result.inventoryCount : 0}%`,
            }}
          />
          <strong>{integer(result.inventoryCoverage.withRecords)}</strong> con
          registros
        </button>
        <button
          onClick={() =>
            onScope({
              catalogPresence:
                request.filters.catalogPresence === "without" ? "" : "without",
            })
          }
        >
          <span
            style={{
              width: `${result.inventoryCount ? (100 * result.inventoryCoverage.withoutRecords) / result.inventoryCount : 0}%`,
            }}
          />
          <strong>{integer(result.inventoryCoverage.withoutRecords)}</strong>{" "}
          sin registros
        </button>
      </div>
      <div
        className="table-scroll"
        ref={table}
        aria-label="Inventario paginado"
      >
        <table>
          <thead>
            <tr>
              <th>Campaña / ID</th>
              <th>Asunto</th>
              <th>Estado / tipo</th>
              <th>Folder / lista</th>
              <th>Actividad</th>
            </tr>
          </thead>
          <tbody>
            {result.inventory.map((entry) => (
              <tr key={entry.row}>
                <td className="campaign-cell">
                  <button
                    className="text-button"
                    onClick={() => setSelected(entry)}
                    title={String(entry.fields.Nombre)}
                  >
                    {String(entry.fields.Nombre)}
                  </button>
                  <small>ID {String(entry.fields.ID ?? "Sin dato")}</small>
                </td>
                <td
                  className="secondary-column"
                  title={String(entry.fields.Asunto || "Sin dato")}
                >
                  <span className="cell-ellipsis">
                    {String(entry.fields.Asunto || "Sin dato")}
                  </span>
                </td>
                <td className="secondary-column">
                  {String(entry.fields.Estado || "Sin dato")}
                  <small>{String(entry.fields.Tipo || "Sin dato")}</small>
                </td>
                <td className="secondary-column">
                  <span className="cell-ellipsis">
                    {String(entry.fields.Folder || "Sin dato")}
                  </span>
                  <small className="cell-ellipsis">
                    {String(entry.fields.Lista || "Sin dato")}
                  </small>
                </td>
                <td>
                  {entry.activity
                    ? `${integer(entry.activity)} registros`
                    : "Sin registros"}
                </td>
              </tr>
            ))}
            {!result.inventory.length && (
              <tr>
                <td colSpan={5}>
                  No hay fichas para estos filtros. Prueba otro nombre o limpia
                  la selección.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager
        page={request.page}
        count={result.inventoryCount}
        pageSize={request.pageSize}
        onChange={(page) => onRequest({ page })}
      />
      {selected && (
        <Dialog
          title="Ficha del inventario"
          className="catalog-dialog"
          onClose={() => setSelected(null)}
        >
          <FieldPages
            fields={{
              ...selected.fields,
              "Fila de catálogo": selected.row,
              "Registros en el corte": selected.activity,
              "Desde actividad": request.filters.from,
              "Hasta actividad": request.filters.to,
            }}
          />
          <button
            disabled={!selected.activity}
            onClick={() => {
              onPerformance(String(selected.fields.Nombre));
              setSelected(null);
            }}
          >
            Ver rendimiento de esta campaña ↗
          </button>
        </Dialog>
      )}
    </section>
  );
}
