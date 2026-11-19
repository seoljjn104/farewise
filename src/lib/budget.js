/**
 * Budget maths. Kept out of the view so the pacing sentence, the marker, and
 * the projected month all read from the same numbers.
 */
import { isoDay, weekStart } from './format.js'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const money = (n) => Number(n) || 0

/** How far through the month a date sits: day, days in month, days left. */
export function monthParts(now = new Date()) {
  const date = new Date(now)
  const day = date.getDate()
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return {
    day,
    days,
    daysLeft: Math.max(0, days - day),
    monthName: MONTHS[date.getMonth()],
  }
}

/**
 * Spend against allowance. usedPct is clamped for the bar, remaining goes
 * negative when overspent, pacing is percentage points ahead of an even month.
 */
export function monthPacing({ spent = 0, allowance = 0, now = new Date() } = {}) {
  const { day, days, daysLeft } = monthParts(now)
  const budget = money(allowance)
  const used = money(spent)

  if (budget <= 0) {
    return {
      remaining: 0,
      usedPct: 0,
      expectedPct: (day / days) * 100,
      pacing: 0,
      daysLeft,
      day,
      days,
    }
  }

  const usedPct = Math.min(100, (used / budget) * 100)
  const expectedPct = (day / days) * 100

  return {
    remaining: Math.round((budget - used) * 100) / 100,
    usedPct,
    expectedPct,
    pacing: usedPct - expectedPct,
    daysLeft,
    day,
    days,
  }
}

/** Straight-line projection from what has been spent so far this month. */
export function projectMonth(spent, day, days) {
  const d = Number(day) || 0
  const total = Number(days) || 0
  if (d <= 0 || total <= 0) return 0
  return Math.round(((money(spent) / d) * total) * 100) / 100
}

/**
 * One bucket per Monday-based week, oldest first, labelled W1..Wn. Only trips
 * inside the window count; anything older is ignored rather than dropped in
 * the first bucket.
 */
export function weeklyBuckets(trips = [], { weeks = 8, now = new Date() } = {}) {
  const count = Math.max(1, Number(weeks) || 8)
  const buckets = new Map()

  for (let i = count - 1; i >= 0; i--) {
    const start = weekStart(now)
    start.setDate(start.getDate() - i * 7)
    const key = isoDay(start)
    buckets.set(key, { key, label: `W${count - i}`, value: 0, start })
  }

  if (!Array.isArray(trips)) return [...buckets.values()]

  for (const trip of trips) {
    if (!trip?.createdAt) continue
    const key = isoDay(weekStart(trip.createdAt))
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.value = Math.round((bucket.value + money(trip.fare)) * 100) / 100
  }

  return [...buckets.values()]
}

/** Share of the total per vehicle class, largest first. */
export function spendByMode(trips = []) {
  if (!Array.isArray(trips)) return []

  const rows = new Map()
  let total = 0
  for (const trip of trips) {
    if (!trip) continue
    const id = trip.modeId || 'unknown'
    const row = rows.get(id) || { id, name: trip.modeName || 'Unknown class', trips: 0, value: 0 }
    const fare = money(trip.fare)
    row.value = Math.round((row.value + fare) * 100) / 100
    row.trips += 1
    total += fare
    rows.set(id, row)
  }

  return [...rows.values()]
    .sort((a, b) => b.value - a.value)
    .map((row) => ({ ...row, pct: total > 0 ? (row.value / total) * 100 : 0 }))
}
