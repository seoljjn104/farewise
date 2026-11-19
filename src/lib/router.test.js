import { describe, it, expect } from 'vitest'
import { parseHash, COMMUTER_TABS } from './router.js'

describe('parseHash', () => {
  it('sends the bare hash to the planner', () => {
    expect(parseHash('')).toEqual({ kind: 'commuter', view: 'plan' })
    expect(parseHash('#')).toEqual({ kind: 'commuter', view: 'plan' })
    expect(parseHash('#/')).toEqual({ kind: 'commuter', view: 'plan' })
  })

  it('reads each commuter tab', () => {
    expect(parseHash('#/plan')).toEqual({ kind: 'commuter', view: 'plan' })
    expect(parseHash('#/trips')).toEqual({ kind: 'commuter', view: 'trips' })
    expect(parseHash('#/budget')).toEqual({ kind: 'commuter', view: 'budget' })
    expect(parseHash('#/alerts')).toEqual({ kind: 'commuter', view: 'alerts' })
    expect(parseHash('#/more')).toEqual({ kind: 'commuter', view: 'more' })
  })

  it('redirects the retired ledger hash', () => {
    expect(parseHash('#/ledger')).toEqual({ kind: 'redirect', to: '#/trips' })
  })

  it('redirects the retired advisories hash', () => {
    expect(parseHash('#/advisories')).toEqual({ kind: 'redirect', to: '#/alerts' })
  })

  it('sends an unknown commuter hash home without a redirect', () => {
    expect(parseHash('#/nope')).toEqual({ kind: 'commuter', view: 'plan' })
  })

  it('reads the admin login route', () => {
    expect(parseHash('#/admin/login')).toEqual({ kind: 'adminLogin' })
  })

  it('defaults the admin console to the tariff panel', () => {
    expect(parseHash('#/admin')).toEqual({ kind: 'admin', panel: 'tariff' })
  })

  it('reads a known admin panel', () => {
    expect(parseHash('#/admin/moderation')).toEqual({ kind: 'admin', panel: 'moderation' })
    expect(parseHash('#/admin/health')).toEqual({ kind: 'admin', panel: 'health' })
    expect(parseHash('#/admin/admins')).toEqual({ kind: 'admin', panel: 'admins' })
  })

  it('falls back to tariff for an unknown admin panel', () => {
    expect(parseHash('#/admin/whatever')).toEqual({ kind: 'admin', panel: 'tariff' })
  })

  it('ignores a query string', () => {
    expect(parseHash('#/trips?sort=highest')).toEqual({ kind: 'commuter', view: 'trips' })
    expect(parseHash('#/admin/health?tab=1')).toEqual({ kind: 'admin', panel: 'health' })
  })

  it('ignores a trailing slash', () => {
    expect(parseHash('#/budget/')).toEqual({ kind: 'commuter', view: 'budget' })
    expect(parseHash('#/admin/login/')).toEqual({ kind: 'adminLogin' })
  })

  it('exposes the five commuter tabs in order', () => {
    expect(COMMUTER_TABS.map((t) => t.id)).toEqual([
      'plan',
      'trips',
      'budget',
      'alerts',
      'more',
    ])
  })
})
