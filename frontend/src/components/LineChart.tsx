import { compact } from '../lib/format'

type Item = { label: string; value: number }
export function LineChart({ items }: { items: Item[] }) {
  const width = 1000, height = 260, pad = 26
  const max = Math.max(...items.map(i => i.value), 1)
  const points = items.map((item, i) => {
    const x = items.length <= 1 ? width / 2 : pad + (i / (items.length - 1)) * (width - pad * 2)
    const y = height - pad - (item.value / max) * (height - pad * 2)
    return { ...item, x, y }
  })
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const first = items[0]?.label || ''
  const mid = items[Math.floor(items.length / 2)]?.label || ''
  const last = items[items.length - 1]?.label || ''
  return (
    <section className="panel panel--wide">
      <div className="panel__head">
        <h2>Evolución de envíos</h2>
        <span className="muted">{items.length} periodos</span>
      </div>
      {items.length === 0 ? <div className="empty">Sin datos para los filtros actuales.</div> : (
        <>
          <div className="linechart" role="img" aria-label="Evolución de envíos">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
              <line x1={pad} x2={width-pad} y1={height-pad} y2={height-pad} className="axis" />
              <line x1={pad} x2={width-pad} y1={pad} y2={pad} className="grid" />
              <line x1={pad} x2={width-pad} y1={height/2} y2={height/2} className="grid" />
              <path d={path} className="trendline" vectorEffect="non-scaling-stroke" />
              {points.length <= 40 && points.map(p => <circle key={p.label} cx={p.x} cy={p.y} r="4" className="dot"><title>{p.label}: {compact.format(p.value)}</title></circle>)}
            </svg>
          </div>
          <div className="linechart__labels"><span>{first}</span><span>{mid}</span><span>{last}</span></div>
        </>
      )}
    </section>
  )
}
