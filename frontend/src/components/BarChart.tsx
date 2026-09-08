import { compact } from '../lib/format'

type Item = { label: string; value: number }
export function BarChart({ items, title }: { items: Item[]; title: string }) {
  const max = Math.max(...items.map(x => x.value), 1)
  return (
    <section className="panel">
      <div className="panel__head"><h2>{title}</h2></div>
      <div className="bars">
        {items.length === 0 && <div className="empty">Sin datos para los filtros actuales.</div>}
        {items.map(item => (
          <div className="barrow" key={item.label} title={`${item.label}: ${item.value.toLocaleString('es-CO')}`}>
            <div className="barrow__label">{item.label}</div>
            <div className="barrow__track"><span style={{ width: `${Math.max((item.value / max) * 100, 1.5)}%` }} /></div>
            <div className="barrow__value">{compact.format(item.value)}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
