/**
 * Pure helpers for the Plan screen. Everything here is data in, data out, so
 * the route card, the ticket, and the logged record cannot disagree.
 */
import { cent } from './fares.js'

/** Raw leg distances, in order, one per gap between stops. */
export function legsKmFromRoute(route) {
  if (!route || !Array.isArray(route.legs)) return []
  return route.legs.map((leg) => Number(leg?.km) || 0)
}

/**
 * Index of the first stop that repeats an earlier one, or -1. Two stops are the
 * same place when they share an id, or share coordinates when no id exists.
 */
export function duplicateIndex(stops = []) {
  const seen = new Set()
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]
    if (!stop) continue
    const key = stop.id ? `id:${stop.id}` : `ll:${stop.lat}|${stop.lng}`
    if (seen.has(key)) return i
    seen.add(key)
  }
  return -1
}

/** A trip can be logged only when every stop resolves and a fare was priced. */
export function canLog(stops, trip) {
  return (
    Boolean(trip) &&
    Array.isArray(stops) &&
    stops.length >= 2 &&
    stops.every((stop) => stop && stop.name)
  )
}

/**
 * The record written to the ledger. Includes the rate snapshot that produced
 * the fare, because matrix rows are edited in place.
 */
export function buildTripRecord({ stops, mode, role, trip, source, now }) {
  const from = stops[0]
  const to = stops[stops.length - 1]
  const at = now === undefined || now === null ? new Date() : new Date(now)

  return {
    createdAt: at.toISOString(),
    fromId: from.id,
    toId: to.id,
    fromName: from.name,
    toName: to.name,
    modeId: mode.id,
    modeName: mode.mode,
    roleId: role.id,
    roleLabel: role.label,
    distanceKm: trip.totalKm,
    distanceSource: source,
    fare: trip.net,
    gross: trip.gross,
    discount: trip.discountAmount,
    legCount: trip.legs.length,
    baseFare: trip.baseFare,
    baseKm: trip.baseKm,
    perKm: trip.perKm,
    discountPct: trip.discountPct,
    matrixSource: mode.source || '',
  }
}

/** Stops with cumulative kilometres, for the ticket timeline. */
export function timeline(stops = [], legsKm = []) {
  let travelled = 0
  return stops.map((stop, i) => {
    if (i > 0) travelled += Number(legsKm[i - 1]) || 0
    return {
      name: stop?.name ?? '',
      km: i === 0 ? 0 : cent(travelled),
      kind: i === 0 ? 'origin' : i === stops.length - 1 ? 'destination' : 'via',
    }
  })
}
