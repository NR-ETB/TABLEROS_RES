import type { RecordRow } from "../types";
import { flags, issueLabels } from "../lib/analysis";
import { integer } from "../lib/numbers";
export function Pager({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / 25));
  return (
    <div className="pager">
      <span>
        {integer(count)} resultados · página {page} de {pages}
      </span>
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <button disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Siguiente
      </button>
    </div>
  );
}
export default function Records({ rows }: { rows: RecordRow[] }) {
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      aria-label="Registros; desplazamiento horizontal disponible"
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
              <td className="campaign-cell">{row.c || "Sin dato"}</td>
              <td>
                {row.f || "Sin dato"}
                <small>{row.p || "Sin dato"}</small>
              </td>
              <td>{integer(row.e)}</td>
              <td>{integer(row.uo)}</td>
              <td>{integer(row.uc)}</td>
              <td>{integer(row.sb + row.hb)}</td>
              <td>
                {Object.entries(flags(row))
                  .filter(([, value]) => value)
                  .map(([key]) => issueLabels[key as keyof typeof issueLabels])
                  .join(" · ") || "Sin incidencias"}
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
  );
}
