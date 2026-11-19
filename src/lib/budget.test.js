import { describe, it, expect } from 'vitest'
import { monthPacing, projectMonth, weeklyBuckets } from './budget.js'

describe('monthPacing', () => {
  const now = new Date('2026-11-15T12:00:00')

  it('reports half the allowance used halfway through November', () => {
    const p = monthPacing({ spent: 450, allowance: 900, now })
    expect(p.usedPct).toBe(50)
    expect(p.expectedPct).toBeCloseTo(50, 1)
    expect(p.remaining).toBe(450)
    expect(p.daysLeft).toBe(15)
  })

  it('clamps overspend and reports negative remaining', () => {
    const p = monthPacing({ spent: 1000, allowance: 900, now })
    expect(p.usedPct).toBe(100)
    expect(p.remaining).toBe(-100)
    expect(p.pacing).toBeGreaterThan(0)
  })

  it('survives an unset allowance without dividing by zero', () => {
    const p = monthPacing({ spent: 450, allowance: 0, now })
    expect(p.usedPct).toBe(0)
    expect(p.remaining).toBe(0)
    expect(p.pacing).toBe(0)
    expect(Number.isFinite(p.expectedPct)).toBe(true)
  })

  it('treats a missing date as today', () => {
    const p = monthPacing({ spent: 10, allowance: 100 })
    expect(p.daysLeft).toBeGreaterThanOrEqual(0)
    expect(p.expectedPct).toBeGreaterThan(0)
  })
})

describe('projectMonth', () => {
  it('scales a half month to a full month', () => {
    expect(projectMonth(450, 15, 30)).toBe(900)
  })

  it('returns zero on day zero', () => {
    expect(projectMonth(0, 0, 30)).toBe(0)
    expect(projectMonth(500, 0, 30)).toBe(0)
  })
})

describe('weeklyBuckets', () => {
  const now = new Date('2026-11-18T12:00:00') // Wednesday
  const trip = (createdAt, fare) => ({ id: createdAt, createdAt, fare })

  it('always returns the requested number of buckets', () => {
    const buckets = weeklyBuckets([], { weeks: 8, now })
    expect(buckets).toHaveLength(8)
    expect(buckets.map((b) => b.label)).toEqual([
      'W1',
      'W2',
      'W3',
      'W4',
      'W5',
      'W6',
      'W7',
      'W8',
    ])
  })

  it('puts a trip from today in the last bucket', () => {
    const buckets = weeklyBuckets([trip('2026-11-18T08:00:00', 20)], { weeks: 8, now })
    expect(buckets).toHaveLength(8)
    expect(buckets[7].value).toBe(20)
    expect(buckets.slice(0, 7).every((b) => b.value === 0)).toBe(true)
  })

  it('adds trips inside the same week and ignores older ones', () => {
    const buckets = weeklyBuckets(
      [
        trip('2026-11-18T08:00:00', 20),
        trip('2026-11-16T08:00:00', 12.5),
        trip('2020-01-01T08:00:00', 99),
      ],
      { weeks: 8, now }
    )
    expect(buckets[7].value).toBe(32.5)
    expect(buckets.reduce((a, b) => a + b.value, 0)).toBe(32.5)
  })
})
