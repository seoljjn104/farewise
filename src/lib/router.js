import { useEffect, useState } from 'react'

/** Commuter navigation. Admin is deliberately absent. */
export const COMMUTER_TABS = [
  { id: 'plan', label: 'Plan', icon: 'route', title: 'Plan a trip', sub: 'Route and fare' },
  { id: 'trips', label: 'Trips', icon: 'receipt', title: 'Your trips', sub: 'Every logged commute' },
  { id: 'budget', label: 'Budget', icon: 'wallet', title: 'Budget', sub: 'Allowance and spend' },
]

/** Admin navigation. */
export const ADMIN_TABS = [
  { id: 'tariff', label: 'Tariff', icon: 'sliders', title: 'Tariff rules', sub: 'Rate rows and audit' },
  { id: 'moderation', label: 'Moderation', icon: 'shield', title: 'Moderate advisories', sub: 'Approve/reject pending' },
  { id: 'health', label: 'Health', icon: 'gauge', title: 'Aggregate health', sub: 'Counts and status' },
  { id: 'settings', label: 'Settings', icon: 'settings', title: 'Settings', sub: 'Appearance and data' },
  { id: 'admins', label: 'Admins', icon: 'users', title: 'Admin roster', sub: 'Operator-provisioned accounts' },
]

const PANELS = new Set(['tariff', 'moderation', 'health', 'admins', 'settings'])

const REDIRECTS = {
  ledger: '#/trips',
}

/**
 * Parse a location hash into one route description. Pure: it never touches
 * `window`, so it can be tested without a DOM.
 */
export function parseHash(hash = '') {
  const path = String(hash)
    .replace(/^#/, '')
    .split('?')[0]
    .replace(/\/+$/, '')
  const parts = path.split('/').filter(Boolean)

  if (parts[0] === 'admin') {
    if (parts[1] === 'login') return { kind: 'adminLogin' }
    const panel = PANELS.has(parts[1]) ? parts[1] : 'tariff'
    return { kind: 'admin', panel }
  }

  const view = parts[0]
  if (!view) return { kind: 'commuter', view: 'plan' }
  if (REDIRECTS[view]) return { kind: 'redirect', to: REDIRECTS[view] }

  return { kind: 'commuter', view: COMMUTER_TABS.some((t) => t.id === view) ? view : 'plan' }
}

export function navigate(hash) {
  const next = String(hash).startsWith('#') ? String(hash) : '#' + hash
  if (window.location.hash !== next) window.location.hash = next
}

const currentHash = () => (typeof window === 'undefined' ? '' : window.location.hash)

export function useHashRoute() {
  const [hash, setHash] = useState(currentHash)

  useEffect(() => {
    const onChange = () => setHash(currentHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return parseHash(hash)
}
