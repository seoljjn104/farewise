/** Formatting helpers. Money and distance always render in the mono face. */

const PESO = '\u20B1' // ₱

export const peso = (n, digits = 2) =>
  PESO + (Number(n) || 0).toFixed(digits)

export const pesoShort = (n) => {
  const v = Number(n) || 0
  return v >= 10000 ? PESO + (v / 1000).toFixed(1) + 'k' : PESO + v.toFixed(0)
}

export const km = (n) => (Number(n) || 0).toFixed(2) + ' km'

export function duration(min) {
  const m = Math.max(0, Math.round(Number(min) || 0))
  if (m < 60) return m + ' min'
  const h = Math.floor(m / 60)
  return h + ' h ' + String(m % 60).padStart(2, '0') + ' m'
}

export const clockTime = (d) =>
  new Date(d).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })

export function dayLabel(d) {
  const date = new Date(d)
  const today = new Date()
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return days + ' days ago'
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

export function fullDate(d) {
  return new Date(d).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Monday-based week start, used by the budget dashboard. */
export function weekStart(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const dow = (x.getDay() + 6) % 7 // Mon = 0
  x.setDate(x.getDate() - dow)
  return x
}

/** Local YYYY-MM-DD, never UTC-shifted. */
export function isoDay(d) {
  const x = new Date(d)
  return [
    x.getFullYear(),
    String(x.getMonth() + 1).padStart(2, '0'),
    String(x.getDate()).padStart(2, '0'),
  ].join('-')
}
