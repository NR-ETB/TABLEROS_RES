export const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })
export const integer = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
export const pct = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const fullDate = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' })

export function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0
}

export function isoLabel(iso: string): string {
  if (!iso) return 'Sin fecha'
  return fullDate.format(new Date(`${iso}T00:00:00Z`))
}
