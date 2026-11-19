import { describe, it, expect } from 'vitest'
import { csvEscape, toCsv, toJson } from './export.js'

const HEADER = 'date,from,to,mode,role,distance_km,gross,discount,fare'

const trip = {
  id: 't1',
  createdAt: '2026-11-18T08:15:00.000Z',
  fromName: 'Mambaling',
  toName: 'Cebu IT Park',
  modeName: 'Traditional Jeepney',
  roleLabel: 'Student',
  distanceKm: 6.9736,
  gross: 19.9472,
  discount: 3.98944,
  fare: 15.95776,
}

describe('csvEscape', () => {
  it('leaves plain text alone', () => {
    expect(csvEscape('plain')).toBe('plain')
  })

  it('quotes commas', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
  })

  it('doubles embedded quotes', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
  })

  it('quotes line breaks', () => {
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"')
  })

  it('turns missing values into an empty field', () => {
    expect(csvEscape(undefined)).toBe('')
    expect(csvEscape(null)).toBe('')
  })

  it('defuses spreadsheet formulas', () => {
    expect(csvEscape('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvEscape('+63 917')).toBe("'+63 917")
    expect(csvEscape('-1')).toBe("'-1")
    expect(csvEscape('@user')).toBe("'@user")
  })
})

describe('toCsv', () => {
  it('writes the header even with no trips', () => {
    expect(toCsv([])).toBe(HEADER)
    expect(toCsv()).toBe(HEADER)
  })

  it('writes one row per trip with two decimal money', () => {
    const lines = toCsv([trip]).split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(HEADER)
    expect(lines[1]).toBe(
      '2026-11-18T08:15:00.000Z,Mambaling,Cebu IT Park,Traditional Jeepney,Student,6.97,19.95,3.99,15.96'
    )
  })

  it('escapes a route name with a comma', () => {
    const row = toCsv([{ ...trip, toName: 'Cebu IT Park, Lahug' }]).split('\n')[1]
    expect(row).toContain('"Cebu IT Park, Lahug"')
  })
})

describe('toJson', () => {
  it('stamps the export time and keeps the state', () => {
    const parsed = JSON.parse(toJson({ version: 2, trips: [] }))
    expect(parsed.version).toBe(2)
    expect(parsed.trips).toEqual([])
    expect(typeof parsed.exportedAt).toBe('string')
    expect(Number.isNaN(Date.parse(parsed.exportedAt))).toBe(false)
  })

  it('produces indented JSON that a human can read', () => {
    expect(toJson({ version: 2 })).toContain('\n  "version": 2')
  })
})
