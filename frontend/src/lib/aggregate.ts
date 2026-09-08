import type { RecordRow } from '../types'

export type Totals = {
  sends: number
  opens: number
  clicks: number
  soft: number
  hard: number
  bounces: number
  delivered: number
  rows: number
}

export function totals(rows: RecordRow[]): Totals {
  let sends = 0, opens = 0, clicks = 0, soft = 0, hard = 0
  for (const r of rows) {
    sends += r.e
    opens += r.uo
    clicks += r.uc
    soft += r.sb
    hard += r.hb
  }
  return { sends, opens, clicks, soft, hard, bounces: soft + hard, delivered: Math.max(sends - soft - hard, 0), rows: rows.length }
}

export function groupSum(rows: RecordRow[], key: (r: RecordRow) => string, limit = 12) {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = key(r) || 'Sin dato'
    map.set(k, (map.get(k) || 0) + r.e)
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

export function trend(rows: RecordRow[]) {
  if (!rows.length) return []
  const dates = rows.filter(r => r.d).map(r => r.d).sort()
  if (!dates.length) return []
  const first = new Date(`${dates[0]}T00:00:00Z`)
  const last = new Date(`${dates[dates.length - 1]}T00:00:00Z`)
  const days = Math.max(1, (last.getTime() - first.getTime()) / 86400000)
  const monthly = days > 120
  const map = new Map<string, number>()
  for (const r of rows) {
    if (!r.d) continue
    const k = monthly ? r.d.slice(0, 7) : r.d
    map.set(k, (map.get(k) || 0) + r.e)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }))
}
