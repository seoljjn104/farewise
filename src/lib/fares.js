/**
 * FareWise fare engine.
 *
 * Mirrors the `fare_matrices` table described in the project charter:
 *   F_gross = B + max(0, D - D_base) * R
 *   F_net   = F_gross * (1 - discount_pct / 100)
 *
 * All rows are sourced from the LTFRB / DOTr provisional fare matrix that took
 * effect 28 September 2026. No rate here is assumed — every value is cited on
 * the row itself and is editable in the Admin Control Panel.
 */

export const FARE_MATRIX_SEED = [
  {
    id: 'puj-traditional',
    code: 'PUJ',
    mode: 'Traditional Jeepney',
    base_fare: 14.0,
    base_km: 4,
    per_km: 2.0,
    discount_pct: 20,
    effective_from: '2026-09-28',
    source: 'LTFRB / DOTr provisional fare matrix, effective 28 Sep 2026',
    active: true,
  },
  {
    id: 'puj-modern',
    code: 'MPUJ',
    mode: 'Modern Jeepney (MPUJ)',
    base_fare: 17.0,
    base_km: 4,
    per_km: 2.4,
    discount_pct: 20,
    effective_from: '2026-09-28',
    source: 'LTFRB / DOTr provisional fare matrix, effective 28 Sep 2026',
    active: true,
  },
  {
    id: 'bus-ordinary',
    code: 'BUS-O',
    mode: 'Provincial Bus — Ordinary',
    base_fare: 12.0,
    base_km: 5,
    per_km: 2.2,
    discount_pct: 20,
    effective_from: '2026-09-28',
    source: 'LTFRB provincial bus fare matrix, effective 28 Sep 2026',
    active: true,
  },
  {
    id: 'bus-aircon',
    code: 'BUS-A',
    mode: 'Provincial Bus — Air-conditioned',
    base_fare: 12.0,
    base_km: 5,
    per_km: 2.45,
    discount_pct: 20,
    effective_from: '2026-09-28',
    source: 'LTFRB provincial bus fare matrix, effective 28 Sep 2026',
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
const cent = (n) => Math.round(n * 100) / 100

/**
 * Compute a single leg.
 * @param {object} row      a fare_matrices row
 * @param {number} km       road distance in kilometres
 * @param {number} discountPct  statutory discount to apply
 */
export function computeFare(row, km, discountPct = 0) {
  if (!row) return null
  const distance = Math.max(0, Number(km) || 0)
  const billable = Math.max(0, distance - Number(row.base_km))
  const excess = billable * Number(row.per_km)
  const gross = Number(row.base_fare) + excess
  const discountAmount = gross * (discountPct / 100)
  const net = gross - discountAmount

  return {
    row,
    distanceKm: cent(distance),
    baseKm: Number(row.base_km),
    baseFare: cent(row.base_fare),
    perKm: Number(row.per_km),
    billableKm: cent(billable),
    excessCharge: cent(excess),
    gross: cent(gross),
    discountPct,
    discountAmount: cent(discountAmount),
    net: cent(net),
  }
}

/**
 * Chain several legs into one itinerary (the charter's multi-leg trip chaining).
 * @param {Array<{row:object, km:number}>} legs
 */
export function computeTrip(legs, discountPct = 0) {
  const priced = legs
    .filter((l) => l.row && Number(l.km) > 0)
    .map((l) => computeFare(l.row, l.km, discountPct))

  const sum = (k) => cent(priced.reduce((a, b) => a + (b[k] || 0), 0))

  return {
    legs: priced,
    totalKm: sum('distanceKm'),
    totalGross: sum('gross'),
    totalDiscount: sum('discountAmount'),
    totalNet: sum('net'),
    discountPct,
  }
}

/** Compare what a trip costs across every active vehicle class. */
export function compareModes(matrix, km, discountPct = 0) {
  return matrix
    .filter((r) => r.active !== false)
    .map((row) => ({ row, ...computeFare(row, km, discountPct) }))
    .sort((a, b) => a.net - b.net)
}
