import { describe, it, expect } from 'vitest'
import { FARE_MATRIX_SEED, priceTrip, roleById } from './fares.js'
import { buildTripRecord, canLog, duplicateIndex, legsKmFromRoute, timeline } from './plan.js'

const puj = FARE_MATRIX_SEED.find((r) => r.id === 'puj-traditional')
const student = roleById('student')
const mambaling = { id: 'mambaling', name: 'Mambaling', lat: 10.29, lng: 123.88 }
const itpark = { id: 'itpark', name: 'Cebu IT Park', lat: 10.33, lng: 123.9 }
const colon = { id: 'colon', name: 'Colon Street', lat: 10.3, lng: 123.89 }

describe('legsKmFromRoute', () => {
  it('reads the raw leg distances in order', () => {
    expect(legsKmFromRoute({ legs: [{ km: 2.5 }, { km: 4.4736 }] })).toEqual([2.5, 4.4736])
  })

  it('returns an empty list for an empty route', () => {
    expect(legsKmFromRoute({ legs: [] })).toEqual([])
    expect(legsKmFromRoute(null)).toEqual([])
  })
})

describe('duplicateIndex', () => {
  it('finds a repeat by place id', () => {
    expect(duplicateIndex([mambaling, mambaling])).toBe(1)
    expect(duplicateIndex([mambaling, itpark, mambaling])).toBe(2)
  })

  it('finds a repeat by coordinates when there is no id', () => {
    expect(duplicateIndex([{ lat: 1, lng: 2 }, { lat: 1, lng: 2 }])).toBe(1)
  })

  it('returns -1 when every stop is distinct', () => {
    expect(duplicateIndex([mambaling, itpark, colon])).toBe(-1)
  })
})

describe('canLog', () => {
  const trip = priceTrip([6.9736], puj, 20)

  it('needs two real stops and a priced trip', () => {
    expect(canLog([mambaling, itpark], trip)).toBe(true)
  })

  it('refuses a half-entered route', () => {
    expect(canLog([mambaling], trip)).toBe(false)
    expect(canLog([mambaling, null], trip)).toBe(false)
    expect(canLog([mambaling, itpark], null)).toBe(false)
  })
})

describe('buildTripRecord', () => {
  it('snapshots the rate that produced the fare', () => {
    const trip = priceTrip([6.9736], puj, 20)
    const record = buildTripRecord({
      stops: [mambaling, itpark],
      mode: puj,
      role: student,
      trip,
      source: 'osrm',
      now: '2026-11-19T08:00:00.000Z',
    })

    expect(record.createdAt).toBe('2026-11-19T08:00:00.000Z')
    expect(record.fare).toBe(15.96)
    expect(record.gross).toBe(19.95)
    expect(record.discount).toBe(3.99)
    expect(record.distanceKm).toBe(6.97)
    expect(record.baseFare).toBe(14)
    expect(record.baseKm).toBe(4)
    expect(record.perKm).toBe(2)
    expect(record.discountPct).toBe(20)
    expect(record.matrixSource).toBe(puj.source)
    expect(record.legCount).toBe(1)
    expect(record.fromName).toBe('Mambaling')
    expect(record.toName).toBe('Cebu IT Park')
  })
})

describe('timeline', () => {
  it('gives an origin and a destination for a two-stop route', () => {
    expect(timeline([mambaling, itpark], [6.9736])).toEqual([
      { name: 'Mambaling', km: 0, kind: 'origin' },
      { name: 'Cebu IT Park', km: 6.97, kind: 'destination' },
    ])
  })

  it('marks the middle stop as a via and accumulates distance', () => {
    const steps = timeline([mambaling, colon, itpark], [3, 4])
    expect(steps.map((s) => s.kind)).toEqual(['origin', 'via', 'destination'])
    expect(steps.map((s) => s.km)).toEqual([0, 3, 7])
  })
})
