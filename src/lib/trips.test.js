import { describe, it, expect } from 'vitest'
import { filterTrips, groupByDay } from './trips.js'

const a = {
  id: 'a',
  createdAt: '2026-11-18T12:00:00.000Z',
  fromName: 'Mambaling',
  toName: 'Cebu IT Park',
  modeId: 'puj-traditional',
  modeName: 'Traditional Jeepney',
  fare: 15.96,
  distanceKm: 6.97,
}
const b = {
  id: 'b',
  createdAt: '2026-11-18T08:00:00.000Z',
  fromName: 'Cebu IT Park',
  toName: 'Mambaling',
  modeId: 'puj-modern',
  modeName: 'Modern Jeepney (MPUJ)',
  fare: 22.4,
  distanceKm: 6.97,
}
const c = {
  id: 'c',
  createdAt: '2026-11-17T12:00:00.000Z',
  fromName: 'Colon Street',
  toName: 'Carbon Market',
  modeId: 'bus-ordinary',
  modeName: 'Provincial Bus — Ordinary',
  fare: 12,
  distanceKm: 11.2,
}

describe('groupByDay', () => {
  it('returns nothing for an empty ledger', () => {
    expect(groupByDay([])).toEqual([])
    expect(groupByDay(null)).toEqual([])
  })

  it('groups by local day, newest day first, newest trip first inside', () => {
    const groups = groupByDay([c, b, a])
    expect(groups).toHaveLength(2)
    expect(groups[0].trips.map((t) => t.id)).toEqual(['a', 'b'])
    expect(groups[1].trips.map((t) => t.id)).toEqual(['c'])
  })
})

describe('filterTrips', () => {
  const all = [a, b, c]

  it('matches a search against either end of the route', () => {
    const hits = filterTrips(all, { q: 'it park', modeId: 'all', sort: 'recent' })
    expect(hits.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('filters by vehicle class', () => {
    const hits = filterTrips(all, {
      q: '',
      modeId: 'puj-traditional',
      sort: 'recent',
    })
    expect(hits.map((t) => t.id)).toEqual(['a'])
  })

  it('sorts by highest fare', () => {
    const hits = filterTrips(all, { q: '', modeId: 'all', sort: 'highest' })
    expect(hits.map((t) => t.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts by longest distance', () => {
    const hits = filterTrips(all, { q: '', modeId: 'all', sort: 'longest' })
    expect(hits.map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })

  it('leaves the input array alone', () => {
    const input = [c, b, a]
    filterTrips(input, { q: '', modeId: 'all', sort: 'highest' })
    expect(input.map((t) => t.id)).toEqual(['c', 'b', 'a'])
  })

  it('tolerates missing fields and an empty argument', () => {
    expect(filterTrips(null)).toEqual([])
    expect(
      filterTrips([{ id: 'x' }], { q: 'anything', modeId: 'all', sort: 'recent' })
    ).toEqual([])
  })
})
