import { useState } from "react";
import type { RecordRow } from "../types";
import { flags, issueLabels } from "../lib/analysis";
import { integer } from "../lib/numbers";
import { usePageCapacity } from "../lib/usePageCapacity";
import Dialog from "./Dialog";
import FieldPages from "./FieldPages";

export function Pager({
  page,
  count,
  onChange,
  pageSize = 25,
}: {
  page: number;
  count: number;
  onChange: (page: number) => void;
  pageSize?: number;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <div className="pager">
      <span>
        {integer(count)} resultados · {page} / {pages}
      </span>
      <button
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Anterior
      </button>
      <button
        aria-label="Página siguiente"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Siguiente
      </button>
    </div>
  );
}
const issues = (row: RecordRow) =>
  Object.entries(flags(row))
    .filter(([, value]) => value)
    .map(([key]) => issueLabels[key as keyof typeof issueLabels])
    .join(" · ") || "Sin incidencias";

export default function Records({
  rows,
  pageSize = 25,
  onCapacity,
}: {
  rows: RecordRow[];
  pageSize?: number;
  onCapacity?: (size: number) => void;
}) {
  const table = usePageCapacity(pageSize, onCapacity);
  const [selected, setSelected] = useState<RecordRow | null>(null),
    [tab, setTab] = useState("datos");
  return (
    <>
      <div
        className="table-scroll records-table"
        ref={table}
        aria-label="Registros paginados"
      >
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Campaña</th>
              <th>Folder / propósito</th>
              <th>Envíos</th>
              <th>Aperturas</th>
              <th>Clics</th>
              <th>Rebotes</th>
              <th>Incidencias</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td>{row.d || "Sin fecha"}</td>
                <td className="campaign-cell">
                  <button
                    className="text-button"
                    title={row.c || "Sin dato"}
                    onClick={() => {
                      setSelected(row);
                      setTab("datos");
                    }}
                  >
                    {row.c || "Sin dato"}
                  </button>
                </td>
                <td className="secondary-column" title={`${row.f} · ${row.p}`}>
                  <span className="cell-ellipsis">{row.f || "Sin dato"}</span>
                  <small className="cell-ellipsis">{row.p || "Sin dato"}</small>
                </td>
                <td>{integer(row.e)}</td>
                <td className="secondary-column">{integer(row.uo)}</td>
                <td className="secondary-column">{integer(row.uc)}</td>
                <td className="secondary-column">{integer(row.sb + row.hb)}</td>
                <td className="secondary-column">
                  <span className="cell-ellipsis" title={issues(row)}>
                    {issues(row)}
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8}>No hay registros para esta selección.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <Dialog
          title="Detalle del registro"
          className="catalog-dialog"
          onClose={() => setSelected(null)}
        >
          <div className="panel-tabs" aria-label="Información del registro">
            <button
              aria-pressed={tab === "fuente"}
              onClick={() => setTab("fuente")}
            >
              Fuente
            </button>
            <button
              aria-pressed={tab === "datos"}
              onClick={() => setTab("datos")}
            >
              Datos
            </button>
            <button
              aria-pressed={tab === "metricas"}
              onClick={() => setTab("metricas")}
            >
              Métricas
            </button>
            <button
              aria-pressed={tab === "calidad"}
              onClick={() => setTab("calidad")}
            >
              Calidad
            </button>
          </div>
          {tab === "fuente" && (
            <FieldPages
              fields={
                selected.source || {
                  "Datos originales":
                    "Este snapshot no incluye los campos originales. Actualiza la fuente para consultarlos.",
                }
              }
            />
          )}
          {tab === "datos" && (
            <FieldPages
              fields={{
                Campaña: selected.c,
                Fecha: selected.d,
                Folder: selected.f,
                Propósito: selected.p,
                Programa: selected.g,
                Tipo: selected.t,
                Estado: selected.s,
                Lista: selected.l,
                "Año de origen": selected.sy,
              }}
            />
          )}
          <dl className="record-info" hidden={tab !== "metricas"}>
            {[
              ["Envíos", selected.e],
              ["Aperturas únicas", selected.uo],
              ["Clics únicos", selected.uc],
              ["Rebotes blandos", selected.sb],
              ["Rebotes duros", selected.hb],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{integer(Number(value))}</dd>
              </div>
            ))}
          </dl>
          <p hidden={tab !== "calidad"}>
            {issues(selected)}. Año de origen: {selected.sy}.
          </p>
        </Dialog>
      )}
    </>
  );
}
