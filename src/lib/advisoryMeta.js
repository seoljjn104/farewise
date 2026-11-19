/**
 * Shared advisory vocabulary. The commuter feed and the admin moderation
 * panel must describe a report the same way, so the labels live here.
 */
export const CATEGORIES = [
  { id: 'route-change', label: 'Route change', icon: 'route', tone: 'info' },
  { id: 'fare-update', label: 'Fare update', icon: 'wallet', tone: 'signal' },
  { id: 'traffic', label: 'Traffic', icon: 'alert', tone: 'danger' },
  { id: 'service', label: 'Service', icon: 'bus', tone: 'neutral' },
]

export const SEVERITY = {
  high: { label: 'High impact', tone: 'danger' },
  medium: { label: 'Moderate', tone: 'signal' },
  low: { label: 'Minor', tone: 'neutral' },
}

export const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Minor' },
  { value: 'medium', label: 'Moderate' },
  { value: 'high', label: 'High' },
]

const FALLBACK = { id: 'other', label: 'Other', icon: 'info', tone: 'neutral' }

export function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || { ...FALLBACK, id: id || FALLBACK.id }
}

export function severityById(id) {
  return SEVERITY[id] || SEVERITY.medium
}
