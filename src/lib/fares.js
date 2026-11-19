/**
 * FareWise fare engine.
 *
 * Mirrors the `fare_matrices` table described in the project charter:
 *   F_gross = B + max(0, D - D_base) * R
 *   F_net   = F_gross * (1 - discount/100)
 *
 * A trip is one fare over its total distance. A via point adds distance; it
 * never adds a second base fare.
 *
 * All rows are sourced from the LTFRB / DOTr provisional fare matrix that took
 * effect 28 November 2026. No rate here is assumed — every value is cited on
 * the row itself and is editable in the Admin Control Panel.
 */

export const FARE_MATRIX_SEED = [
  {
    id: 'puj-traditional',
    code: 'PUJ',
    mode: 'Traditional Jeepney',
    base_fare: 14.5,
    base_km: 4,
    per_km: 2.1,
    discount_pct: 20,
    effective_from: '2026-11-01',
    source: 'LTFRB / DOTr provisional fare matrix, effective 28 Nov 2026',
    active: true,
  },
  {
    id: 'puj-modern',
    code: 'MPUJ',
    mode: 'Modern Jeepney (MPUJ)',
    base_fare: 17.5,
    base_km: 4,
    per_km: 2.5,
    discount_pct: 20,
    effective_from: '2026-11-01',
    source: 'LTFRB / DOTr provisional fare matrix, effective 28 Nov 2026',
    active: true,
  },
  {
    id: 'bus-ordinary',
    code: 'BUS-O',
    mode: 'Provincial Bus — Ordinary',
    base_fare: 12.5,
    base_km: 5,
    per_km: 2.3,
    discount_pct: 20,
    effective_from: '2026-11-01',
    source: 'LTFRB provincial bus fare matrix, effective 28 Nov 2026',
    active: true,
  },
  {
    id: 'bus-aircon',
    code: 'BUS-A',
    mode: 'Provincial Bus — Air-conditioned',
    base_fare: 12.5,
    base_km: 5,
    per_km: 2.55,
    discount_pct: 20,
    effective_from: '2026-11-01',
    source: 'LTFRB provincial bus fare matrix, effective 28 Nov 2026',
    active: true,
  },
]

/** Commuter roles. The 20% statutory discount is fixed by LTFRB for three of them. */
export const ROLES = [
  { id: 'regular', label: 'Regular', discount_pct: 0, statutory: false },
  { id: 'student', label: 'Student', discount_pct: 20, statutory: true },
  { id: 'senior', label: 'Senior Citizen', discount_pct: 20, statutory: true },
  { id: 'pwd', label: 'PWD', discount_pct: 20, statutory: true },
]

export const roleById = (id) => ROLES.find((r) => r.id === id) || ROLES[0]

/** Round to centavos. Applied once, at the end, so no rounding drift accumulates. */
export const cent = (n) => Math.round(n * 100) / 100

const clampPct = (n) => Math.min(100, Math.max(0, n))

const num = (value, fallback = 0) => {
  if (value === '' || value === null || value === undefined) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * The discount a class will actually grant. A row's `discount_pct` is a cap:
 * it can lower the statutory discount, never raise it.
 */
export function effectiveDiscountPct(row, commuterDiscountPct = 0) {
  const entitled = clampPct(num(commuterDiscountPct))
  const cap = clampPct(num(row?.discount_pct, 100))
  return Math.min(entitled, cap)
}

/**
 * A row is only billable when it is active and carries a real base fare and
 * per-km rate. A zero-rate row must never become the cheapest result.
 */
export function billableRows(matrix = []) {
  return matrix.filter(
    (row) => row?.active !== false && num(row?.base_fare) > 0 && num(row?.per_km) > 0,
  )
}

/**
 * Coerce an edited row into a safe shape. Invalid numbers become zero, and a
 * row without a base fare and a per-km rate cannot stay active.
 */
export function sanitizeRateRow(row = {}) {
  const baseFare = Math.max(0, num(row.base_fare))
  const baseKm = Math.max(0, num(row.base_km))
  const perKm = Math.max(0, num(row.per_km))
  const discountPct = clampPct(num(row.discount_pct, 100))

  return {
    ...row,
    base_fare: baseFare,
    base_km: baseKm,
    per_km: perKm,
    discount_pct: discountPct,
    active: Boolean(row.active) && baseFare > 0 && perKm > 0,
  }
}

/**
 * Price a distance under one fare row.
 * @param {object} row          a fare_matrices row
 * @param {number} km           road distance in kilometres, unrounded
 * @param {number} discountPct  the commuter's statutory entitlement
 */
export function computeFare(row, km, discountPct = 0) {
  if (!row) return null

  const distance = Math.max(0, num(km))
  const baseKm = Math.max(0, num(row.base_km))
  const perKm = Math.max(0, num(row.per_km))
  const baseFare = Math.max(0, num(row.base_fare))

  const billable = Math.max(0, distance - baseKm)
  const excess = billable * perKm
  const gross = baseFare + excess
  const appliedPct = effectiveDiscountPct(row, discountPct)
  const discountAmount = gross * (appliedPct / 100)
  const net = gross - discountAmount

  return {
    row,
    distanceKm: cent(distance),
    baseKm: cent(baseKm),
    baseFare: cent(baseFare),
    perKm,
    billableKm: cent(billable),
    excessCharge: cent(excess),
    gross: cent(gross),
    discountPct: appliedPct,
    discountAmount: cent(discountAmount),
    net: cent(net),
  }
}

/**
 * Price a whole trip as one fare. `legsKm` keeps one entry per leg so labels
 * stay aligned with the route, but only non-zero legs add distance.
 * @param {number[]} legsKm
 * @param {object} row
 * @param {number} discountPct
 */
export function priceTrip(legsKm, row, discountPct = 0) {
  if (!row || !Array.isArray(legsKm) || legsKm.length === 0) return null

  const values = legsKm.map((km) => Math.max(0, num(km)))
  const legs = values.map((value) => ({ km: cent(value), skipped: value <= 0 }))

  // Sum the raw distances. Rounding each leg first would lose the demo route's
  // last four metres and move the fare by a centavo.
  const totalKm = values.reduce((sum, value) => sum + value, 0)
  const fare = computeFare(row, totalKm, discountPct)
  if (!fare || fare.distanceKm <= 0) return null

  return { ...fare, legs, totalKm: fare.distanceKm }
}

/** Compare what a trip costs across every billable vehicle class. */
export function compareModes(matrix, km, discountPct = 0) {
  return billableRows(matrix)
    .map((row) => computeFare(row, km, discountPct))
    .filter(Boolean)
    .sort((a, b) => a.net - b.net)
}
