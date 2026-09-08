import { useMemo, useState } from 'react'
import type { RecordRow } from '../types'
import { integer, isoLabel } from '../lib/format'

export function DataTable({ rows, onExport }: { rows: RecordRow[]; onExport: () => void }) {
  const [page, setPage] = useState(0)
  const pageSize = 25
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  if (page >= pages) setTimeout(() => setPage(Math.max(0, pages - 1)), 0)
  const visible = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page])
  return (
    <section className="panel panel--wide table-panel">
      <div className="panel__head table-head">
        <div><h2>Detalle</h2><span className="muted">{integer.format(rows.length)} registros</span></div>
        <button className="btn" onClick={onExport}>Exportar CSV</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Fecha</th><th>Campaña</th><th>Propósito</th><th>Folder</th><th>Programa</th><th className="num">Envíos</th><th className="num">Opens</th><th className="num">Clicks</th><th>Cruce</th></tr></thead>
          <tbody>
            {visible.map((r, i) => <tr key={`${r.d}-${r.c}-${r.g}-${i}`}><td>{isoLabel(r.d)}</td><td className="strong">{r.c || 'Sin campaña'}</td><td>{r.p || '—'}</td><td>{r.f || '—'}</td><td>{r.g || '—'}</td><td className="num">{integer.format(r.e)}</td><td className="num">{integer.format(r.uo)}</td><td className="num">{integer.format(r.uc)}</td><td><span className={`match ${r.cm && r.fm ? 'match--ok' : 'match--warn'}`}>{r.cm && r.fm ? 'OK' : 'Revisar'}</span></td></tr>)}
            {!visible.length && <tr><td colSpan={9} className="empty">Sin registros para los filtros actuales.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pager"><button className="icon-btn" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p-1))}>‹</button><span>Página {page+1} de {pages}</span><button className="icon-btn" disabled={page >= pages-1} onClick={() => setPage(p => Math.min(pages-1, p+1))}>›</button></div>
    </section>
  )
}
