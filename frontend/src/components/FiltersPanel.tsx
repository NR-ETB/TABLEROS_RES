import type { DashboardData, Filters } from '../types'

type Props = {
  data: DashboardData
  filters: Filters
  onChange: (next: Filters) => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function FiltersPanel({ data, filters, onChange, mobileOpen, onCloseMobile }: Props) {
  const set = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value })
  const clear = () => onChange({
    from: data.meta.earliestSentDate, to: data.meta.latestSentDate,
    purpose: '', folder: '', program: '', type: '', status: '', campaign: '', quality: '',
  })
  return (
    <aside className={`filters ${mobileOpen ? 'filters--open' : ''}`} aria-label="Filtros del tablero">
      <div className="filters__head"><h2>Filtros</h2><button className="icon-btn mobile-only" onClick={onCloseMobile} aria-label="Cerrar filtros">×</button></div>
      <label>Desde<input type="date" value={filters.from} min={data.meta.earliestSentDate} max={filters.to || data.meta.latestSentDate} onChange={e => set('from', e.target.value)} /></label>
      <label>Hasta<input type="date" value={filters.to} min={filters.from || data.meta.earliestSentDate} max={data.meta.latestSentDate} onChange={e => set('to', e.target.value)} /></label>
      <label>Propósito<select value={filters.purpose} onChange={e => set('purpose', e.target.value)}><option value="">Todos</option>{data.filters.purposes.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Folder<select value={filters.folder} onChange={e => set('folder', e.target.value)}><option value="">Todos</option>{data.filters.folders.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Programa<select value={filters.program} onChange={e => set('program', e.target.value)}><option value="">Todos</option>{data.filters.programs.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Tipo<select value={filters.type} onChange={e => set('type', e.target.value)}><option value="">Todos</option>{data.filters.types.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Estado campaña<select value={filters.status} onChange={e => set('status', e.target.value)}><option value="">Todos</option>{data.filters.statuses.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Calidad del cruce<select value={filters.quality} onChange={e => set('quality', e.target.value)}><option value="">Todas</option><option value="matched">Cruce completo</option><option value="unmatched">Con inconsistencia</option></select></label>
      <label>Buscar campaña<input type="search" placeholder="Nombre contiene…" value={filters.campaign} onChange={e => set('campaign', e.target.value)} /></label>
      <button className="btn btn--ghost" onClick={clear}>Limpiar filtros</button>
    </aside>
  )
}
