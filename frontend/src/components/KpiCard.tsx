type Props = { label: string; value: string; helper?: string; tone?: 'default' | 'good' | 'warn' }
export function KpiCard({ label, value, helper, tone = 'default' }: Props) {
  return (
    <article className={`kpi kpi--${tone}`}>
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value}</div>
      {helper && <div className="kpi__helper">{helper}</div>}
    </article>
  )
}
