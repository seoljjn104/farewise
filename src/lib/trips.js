/**
 * Trip ledger helpers. Sorting and grouping are pure so the list, the totals,
 * and the undo position cannot drift apart.
 */
import { isoDay } from './format.js'

const time = (trip) => {
  const value = new Date(trip?.createdAt).getTime()
  return Number.isFinite(value) ? value : 0
}

const newestFirst = (a, b) => time(b) - time(a)

const money = (n) => Number(n) || 0

/** Newest day first, newest trip first inside each day. */
export function groupByDay(trips = []) {
  if (!Array.isArray(trips)) return []

  const groups = new Map()
  for (const trip of [...trips].sort(newestFirst)) {
    if (!trip) continue
    const day = isoDay(trip.createdAt)
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day).push(trip)
  }

  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, items]) => ({ day, trips: items }))
}

const SORTS = {
  recent: newestFirst,
  highest: (a, b) => money(b.fare) - money(a.fare) || newestFirst(a, b),
  longest: (a, b) => money(b.distanceKm) - money(a.distanceKm) || newestFirst(a, b),
}

/** Search the route and the class, then apply the chosen order. */
export function filterTrips(trips = [], { q = '', modeId = 'all', sort = 'recent' } = {}) {
  if (!Array.isArray(trips)) return []

  const needle = String(q || '').trim().toLowerCase()
  const hits = trips.filter((trip) => {
    if (!trip) return false
    if (modeId && modeId !== 'all' && trip.modeId !== modeId) return false
    if (!needle) return true
    return [trip.fromName, trip.toName, trip.modeName].some((value) =>
      String(value || '').toLowerCase().includes(needle)
    )
  })

  return hits.sort(SORTS[sort] || newestFirst)
}
