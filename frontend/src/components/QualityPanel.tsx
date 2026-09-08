import type { DashboardData } from '../types'
import { integer, pct } from '../lib/format'

export function QualityPanel({ data }: { data: DashboardData }) {
  const q = data.quality
  return (
    <section className="panel quality-panel">
      <div className="panel__head"><h2>Calidad y cruce de fuente</h2><span className="quality-badge">Auditable</span></div>
      <div className="quality-grid">
        <div><strong>{pct.format(q.campaignMatchPct)}%</strong><span>filas con campaña cruzada</span></div>
        <div><strong>{pct.format(q.folderMatchPct)}%</strong><span>filas con folder cruzado</span></div>
        <div><strong>{integer.format(q.sourceYearMismatchRows)}</strong><span>fecha fuera del año de la pestaña</span></div>
        <div><strong>{integer.format(q.rowsWithoutSentDate)}</strong><span>filas sin Sent Date</span></div>
      </div>
      {(q.topUnmatchedCampaigns.length > 0 || q.topUnmatchedFolders.length > 0) && (
        <details className="quality-details">
          <summary>Ver inconsistencias encontradas</summary>
          <div className="quality-lists">
            <div>
              <h3>Campañas sin catálogo</h3>
              {q.topUnmatchedCampaigns.slice(0, 8).map(x => <div className="issue-row" key={x.name}><span>{x.name}</span><b>{x.rows}</b></div>)}
            </div>
            <div>
              <h3>Folders sin catálogo</h3>
              {q.topUnmatchedFolders.length ? q.topUnmatchedFolders.slice(0, 8).map(x => <div className="issue-row" key={x.name}><span>{x.name}</span><b>{x.rows}</b></div>) : <p className="muted">Sin inconsistencias.</p>}
            </div>
          </div>
        </details>
      )}
    </section>
  )
}
