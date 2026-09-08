import { useEffect, useMemo, useState } from 'react'
import type { DashboardData, Filters, RecordRow } from './types'
import { compact, integer, pct, safeRate, isoLabel } from './lib/format'
import { groupSum, totals, trend } from './lib/aggregate'
import { KpiCard } from './components/KpiCard'
import { BarChart } from './components/BarChart'
import { LineChart } from './components/LineChart'
import { FiltersPanel } from './components/FiltersPanel'
import { QualityPanel } from './components/QualityPanel'
import { DataTable } from './components/DataTable'

const DATA_URL = `${import.meta.env.BASE_URL}data/dashboard.json`

function initialFilters(data: DashboardData): Filters {
  return { from: data.meta.earliestSentDate, to: data.meta.latestSentDate, purpose: '', folder: '', program: '', type: '', status: '', campaign: '', quality: '' }
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [filters, setFilters] = useState<Filters | null>(null)
  const [error, setError] = useState('')
  const [mobileFilters, setMobileFilters] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(DATA_URL, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d: DashboardData) => { if (alive) { setData(d); setFilters(initialFilters(d)) } })
      .catch(e => alive && setError(`No fue posible cargar la fuente del tablero: ${e.message}`))
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    if (!data || !filters) return [] as RecordRow[]
    const campaignNeedle = filters.campaign.trim().toLocaleLowerCase('es')
    return data.records.filter(r => {
      if (filters.from && r.d && r.d < filters.from) return false
      if (filters.to && r.d && r.d > filters.to) return false
      if (filters.purpose && r.p !== filters.purpose) return false
      if (filters.folder && r.f !== filters.folder) return false
      if (filters.program && r.g !== filters.program) return false
      if (filters.type && r.t !== filters.type) return false
      if (filters.status && r.s !== filters.status) return false
      if (campaignNeedle && !r.c.toLocaleLowerCase('es').includes(campaignNeedle)) return false
      if (filters.quality === 'matched' && !(r.cm && r.fm)) return false
      if (filters.quality === 'unmatched' && (r.cm && r.fm)) return false
      return true
    })
  }, [data, filters])

  const summary = useMemo(() => totals(filtered), [filtered])
  const trendItems = useMemo(() => trend(filtered), [filtered])
  const topCampaigns = useMemo(() => groupSum(filtered, r => r.c, 10), [filtered])
  const byFolder = useMemo(() => groupSum(filtered, r => r.f, 8), [filtered])
  const byPurpose = useMemo(() => groupSum(filtered, r => r.p, 5), [filtered])

  const exportCsv = () => {
    const header = ['Sent Date','Campaña','Proposito','Folder','Programa','Envios','Soft Bounces','Hard Bounces','Unique Opens','Unique Clicks','Tipo','Estado','Cruce Campaña','Cruce Folder']
    const quote = (v: unknown) => `"${String(v ?? '').replaceAll('"','""')}"`
    const lines = [header.map(quote).join(';')]
    for (const r of filtered) lines.push([r.d,r.c,r.p,r.f,r.g,r.e,r.sb,r.hb,r.uo,r.uc,r.t,r.s,r.cm ? 'SI':'NO',r.fm ? 'SI':'NO'].map(quote).join(';'))
    const blob = new Blob(['\ufeff', lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `responsys_filtrado_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  if (error) return <main className="state"><h1>Responsys</h1><p>{error}</p></main>
  if (!data || !filters) return <main className="state"><div className="loader" /><p>Cargando datos optimizados…</p></main>

  const delivery = safeRate(summary.delivered, summary.sends)
  const open = safeRate(summary.opens, summary.sends)
  const click = safeRate(summary.clicks, summary.sends)
  const bounce = safeRate(summary.bounces, summary.sends)
  const fullMatchRows = filtered.filter(r => r.cm && r.fm).length
  const matchPct = safeRate(fullMatchRows, filtered.length)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div><div className="eyebrow">ETB · RESPONSYS</div><h1>Inventario y rendimiento de campañas</h1><p>Fuente viva consolidada 2024–2026 · corte por <b>Sent Date</b></p></div>
        <div className="topbar__meta"><span className="live-dot" /> Datos hasta <b>{isoLabel(data.meta.latestSentDate)}</b><small>Hash {data.meta.dataHash}</small></div>
      </header>

      <div className="mobile-actions mobile-only"><button className="btn" onClick={() => setMobileFilters(true)}>Filtros</button><span>{integer.format(filtered.length)} filas</span></div>

      <div className="layout">
        <FiltersPanel data={data} filters={filters} onChange={setFilters} mobileOpen={mobileFilters} onCloseMobile={() => setMobileFilters(false)} />
        {mobileFilters && <button className="scrim mobile-only" aria-label="Cerrar filtros" onClick={() => setMobileFilters(false)} />}

        <main className="content">
          <section className="kpi-grid">
            <KpiCard label="Envíos" value={integer.format(summary.sends)} helper={`${integer.format(summary.rows)} registros`} />
            <KpiCard label="Entrega calculada" value={`${pct.format(delivery)}%`} helper={`${compact.format(summary.delivered)} entregados`} tone={delivery >= 95 ? 'good' : 'warn'} />
            <KpiCard label="Unique opens / envíos" value={`${pct.format(open)}%`} helper={integer.format(summary.opens)} />
            <KpiCard label="Unique clicks / envíos" value={`${pct.format(click)}%`} helper={integer.format(summary.clicks)} />
            <KpiCard label="Rebote / envíos" value={`${pct.format(bounce)}%`} helper={`${integer.format(summary.bounces)} rebotes`} tone={bounce <= 5 ? 'good' : 'warn'} />
            <KpiCard label="Cruce catálogos" value={`${pct.format(matchPct)}%`} helper="Campaña + folder" tone={matchPct >= 99 ? 'good' : 'warn'} />
          </section>

          <LineChart items={trendItems} />
          <div className="chart-grid"><BarChart title="Top campañas por envíos" items={topCampaigns} /><BarChart title="Envíos por folder" items={byFolder} /></div>
          <BarChart title="Distribución por propósito" items={byPurpose} />
          <QualityPanel data={data} />
          <DataTable rows={filtered} onExport={exportCsv} />

          <footer className="footer-note">
            <b>Definiciones:</b> las tasas mostradas se recalculan desde conteos base; no se usan directamente las columnas de rate de Responsys. El eje temporal usa Sent Date. Registros no cruzados se conservan y se marcan para revisión.
          </footer>
        </main>
      </div>
    </div>
  )
}
