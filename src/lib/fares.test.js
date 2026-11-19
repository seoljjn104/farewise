import { describe, it, expect } from 'vitest'
import {
  FARE_MATRIX_SEED,
  computeFare,
  priceTrip,
  compareModes,
  billableRows,
  effectiveDiscountPct,
  sanitizeRateRow,
} from './fares.js'

const puj = FARE_MATRIX_SEED.find((r) => r.id === 'puj-traditional')
const cent = (n) => Math.round(n * 100) / 100

describe('computeFare', () => {
  it('charges the base fare below the covered distance', () => {
    expect(computeFare(puj, 3).gross).toBe(14)
  })

  it('charges the base fare exactly at the covered distance', () => {
    expect(computeFare(puj, 4).gross).toBe(14)
  })

  it('prices the demo trip from the raw distance', () => {
    const fare = computeFare(puj, 6.9736, 20)
    expect(fare.distanceKm).toBe(6.97)
    expect(fare.billableKm).toBe(2.97)
    expect(fare.excessCharge).toBe(5.95)
    expect(fare.gross).toBe(19.95)
    expect(fare.discountPct).toBe(20)
    expect(fare.discountAmount).toBe(3.99)
    expect(fare.net).toBe(15.96)
  })

  it('applies no discount for a regular commuter', () => {
    expect(computeFare(puj, 6.9736, 0).net).toBe(19.95)
  })

  it('honours a row that caps the statutory discount at zero', () => {
    expect(computeFare({ ...puj, discount_pct: 0 }, 6.9736, 20).net).toBe(19.95)
  })

  it('coerces string rates from an input field', () => {
    const fare = computeFare({ ...puj, per_km: '2.00' }, 6.9736, 20)
    expect(fare.net).toBe(15.96)
  })
})

describe('effectiveDiscountPct', () => {
  it('takes the lower of commuter discount and row cap', () => {
    expect(effectiveDiscountPct({ ...puj, discount_pct: 10 }, 20)).toBe(10)
  })

  it('never raises the discount above the commuter entitlement', () => {
    expect(effectiveDiscountPct({ ...puj, discount_pct: 50 }, 20)).toBe(20)
  })

  it('falls back to the commuter discount when the row has no cap', () => {
    const { discount_pct: _discount, ...uncapped } = puj
    expect(effectiveDiscountPct(uncapped, 20)).toBe(20)
  })
})

describe('priceTrip', () => {
  it('prices one leg at the demo fare', () => {
    const trip = priceTrip([6.9736], puj, 20)
    expect(trip.totalKm).toBe(6.97)
    expect(trip.gross).toBe(19.95)
    expect(trip.net).toBe(15.96)
    expect(trip.legs).toHaveLength(1)
    expect(trip.legs[0].skipped).toBe(false)
  })

  it('charges one base fare for a trip with a via point', () => {
    const trip = priceTrip([3, 3], puj, 0)
    expect(trip.totalKm).toBe(6)
    expect(trip.gross).toBe(18)
    expect(trip.net).toBe(18)
    expect(trip.legs).toHaveLength(2)
  })

  it('keeps a zero-distance leg aligned without pricing it', () => {
    const trip = priceTrip([6.9736, 0], puj, 20)
    expect(trip.totalKm).toBe(6.97)
    expect(trip.gross).toBe(19.95)
    expect(trip.legs).toHaveLength(2)
    expect(trip.legs[1].skipped).toBe(true)
  })

  it('returns null when there is nothing to price', () => {
    expect(priceTrip([0], puj)).toBeNull()
    expect(priceTrip([], puj)).toBeNull()
    expect(priceTrip([1], null)).toBeNull()
  })
})

describe('comparison', () => {
  it('sorts active classes by net fare', () => {
    const ids = compareModes(billableRows(FARE_MATRIX_SEED), 6.9736, 20).map((c) => c.row.id)
    expect(ids).toEqual(['bus-ordinary', 'bus-aircon', 'puj-traditional', 'puj-modern'])
  })

  it('excludes inactive and zero-rate rows', () => {
    const rows = billableRows([
      ...FARE_MATRIX_SEED,
      { id: 'zero', active: true, base_fare: 0, per_km: 0 },
      { id: 'off', active: false, base_fare: 12, per_km: 2 },
    ])
    expect(rows.map((r) => r.id)).not.toContain('zero')
    expect(rows.map((r) => r.id)).not.toContain('off')
  })
})

describe('sanitizeRateRow', () => {
  it('deactivates a row with an empty base fare', () => {
    expect(sanitizeRateRow({ base_fare: '', per_km: 2, active: true }).active).toBe(false)
  })

  it('floors a negative rate at zero', () => {
    expect(sanitizeRateRow({ base_fare: 14, per_km: -2, active: true }).per_km).toBe(0)
  })

  it('clamps the discount cap to 0..100', () => {
    expect(sanitizeRateRow({ base_fare: 14, per_km: 2, discount_pct: 150 }).discount_pct).toBe(100)
    expect(sanitizeRateRow({ base_fare: 14, per_km: 2, discount_pct: -5 }).discount_pct).toBe(0)
  })

  it('keeps a valid active row active', () => {
    expect(sanitizeRateRow({ base_fare: 14, per_km: 2, active: true }).active).toBe(true)
  })
})

describe('displayed build-up adds up', () => {
  it('keeps gross minus discount within a centavo of net', () => {
    for (const row of FARE_MATRIX_SEED) {
      for (let km = 0.5; km <= 20; km += 0.137) {
        for (const pct of [0, 20]) {
          const f = computeFare(row, km, pct)
          const drift = Math.abs(cent(f.gross) - cent(f.discountAmount) - cent(f.net))
          expect(drift).toBeLessThanOrEqual(0.0100001)
        }
      }
    }
  })
})
