/**
 * Demo seed data.
 *
 * Trips are *computed* from the fare matrix with the same engine the app uses at
 * runtime — nothing here is a made-up peso figure. Distances come from the
 * offline road-factor estimate so seeding is instant and deterministic.
 */
import { FARE_MATRIX_SEED, computeFare, roleById } from '../lib/fares.js'
import { haversineKm, ROAD_FACTOR } from '../lib/geo.js'
import places from '../data/places.json'

const byId = Object.fromEntries(places.map((p) => [p.id, p]))

export function tripDistance(fromId, toId) {
  const a = byId[fromId]
  const b = byId[toId]
  if (!a || !b) return 0
  return Math.round(haversineKm(a, b) * ROAD_FACTOR * 100) / 100
}

const daysAgo = (n, hour = 7, minute = 30) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/**
 * A realistic eight-week student commute: home → school in the morning and back
 * in the evening on every weekday, with the occasional errand. Every figure is
 * computed from the fare matrix, so the ledger and the budget agree by construction.
 */
export function buildSeedTrips() {
  const matrix = Object.fromEntries(FARE_MATRIX_SEED.map((r) => [r.id, r]))
  const rows = []
  let n = 0

  function push(from, to, modeId, roleId, day, hour, minute) {
    const row = matrix[modeId]
    const role = roleById(roleId)
    const distance = tripDistance(from, to)
    const priced = computeFare(row, distance, role.discount_pct)
    rows.push({
      id: 'seed-' + n++,
      createdAt: daysAgo(day, hour, minute),
      fromId: from,
      toId: to,
      fromName: byId[from].name,
      toName: byId[to].name,
      modeId,
      modeName: row.mode,
      roleId,
      roleLabel: role.label,
      distanceKm: distance,
      distanceSource: 'estimate',
      fare: priced.net,
      gross: priced.gross,
      discount: priced.discountAmount,
      legCount: 1,
      seed: true,
    })
  }

  const HOME = 'mambaling'
  const SCHOOL = 'itpark'

  for (let d = 55; d >= 0; d--) {
    const dow = new Date(daysAgo(d)).getDay()
    if (dow === 0 || dow === 6) continue // no commute at the weekend
    const mode = d % 7 === 3 ? 'puj-modern' : 'puj-traditional' // modern unit once a week
    push(HOME, SCHOOL, mode, 'student', d, 7, 30)
    push(SCHOOL, HOME, mode, 'student', d, 18, 10)
  }

  // one-off errands so the ledger is not perfectly uniform
  push('colon', 'mcita', 'bus-ordinary', 'student', 46, 5, 40)
  push('carbon', 'northbus', 'puj-traditional', 'student', 39, 9, 5)
  push('ayala', 'smcity', 'puj-traditional', 'regular', 31, 16, 20)
  push(HOME, 'colon', 'puj-modern', 'student', 24, 20, 15)
  push('mactannewtown', 'smcity', 'bus-aircon', 'regular', 17, 15, 45)
  push('fuente', 'banilad', 'puj-traditional', 'student', 11, 8, 25)
  push('colon', 'mcita', 'bus-ordinary', 'student', 6, 5, 40)
  push(HOME, 'colon', 'puj-modern', 'student', 2, 20, 15)

  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export const ADVISORY_SEED = [
  {
    id: 'adv-1',
    title: 'Colon Street one-way scheme — southbound detour',
    body:
      'Southbound jeepneys along Colon Street are rerouted via Junquera Street while the drainage works are ongoing. Expect roughly 8 minutes of additional travel time between Carbon Market and Fuente Osmeña.',
    category: 'route-change',
    severity: 'high',
    area: 'Cebu City — Downtown',
    author: 'FareWise Ops',
    createdAt: daysAgo(0, 6, 20),
    status: 'published',
    confirms: 34,
  },
  {
    id: 'adv-2',
    title: 'Provisional fare matrix now in effect',
    body:
      'The LTFRB provisional fare increase took effect 28 September 2026. Traditional jeepneys are now ₱14.00 for the first 4 km plus ₱2.00 per succeeding kilometre; modern jeepneys ₱17.00 for the first 4 km plus ₱2.40. FareWise has been updated for all vehicle classes.',
    category: 'fare-update',
    severity: 'medium',
    area: 'Region VII — Metro Cebu',
    author: 'FareWise Ops',
    createdAt: daysAgo(1, 8, 5),
    status: 'published',
    confirms: 71,
  },
  {
    id: 'adv-3',
    title: 'Heavy build-up on M. C. Briones St. near Parkmall',
    body:
      'Queueing traffic northbound approaching the Mandaue reclamation area. Commuters heading to the airport should allow an extra 15 minutes or consider boarding at the North Bus Terminal instead.',
    category: 'traffic',
    severity: 'medium',
    area: 'Mandaue City',
    author: 'Community',
    createdAt: daysAgo(2, 17, 40),
    status: 'published',
    confirms: 19,
  },
  {
    id: 'adv-4',
    title: 'Modern jeepney units pulled for inspection on the Talamban line',
    body:
      'A reduced number of modern jeepney units are running the Talamban corridor today, so intervals are longer than the posted headway. Traditional jeepneys on the same corridor are operating normally.',
    category: 'service',
    severity: 'low',
    area: 'Cebu City — Talamban',
    author: 'Community',
    createdAt: daysAgo(3, 9, 15),
    status: 'pending',
    confirms: 6,
  },
  {
    id: 'adv-5',
    title: 'Airport route fare changed without notice — for verification',
    body:
      'A commuter reports being charged more than the posted provincial bus rate on the Mactan airport route. Submitted for moderator review before it is shown to the public.',
    category: 'fare-update',
    severity: 'high',
    area: 'Lapu-Lapu City',
    author: 'Community',
    createdAt: daysAgo(4, 19, 50),
    status: 'pending',
    confirms: 3,
  },
]

export const SETTINGS_SEED = {
  monthlyAllowance: 900,
  defaultRole: 'student',
  defaultModeId: 'puj-traditional',
  homeId: 'mambaling',
  schoolId: 'itpark',
  weeklyCommuteDays: 5,
}

/**
 * The local demo administrator. Identity only: the password gate lives in
 * `src/lib/auth.js` and, once hosted, in the provider. There is no password
 * field here and there must never be one.
 */
export const ADMIN_SEED = {
  id: 'admin-local',
  displayName: 'Local admin',
  role: 'admin',
  mfaEnrolled: false,
  createdAt: new Date().toISOString(),
}

