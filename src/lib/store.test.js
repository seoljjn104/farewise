import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FARE_MATRIX_SEED, billableRows } from './fares.js'

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  const api = {
    failWrites: false,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (api.failWrites) throw new Error('QuotaExceededError')
      map.set(k, String(v))
    },
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    has: (k) => map.has(k),
  }
  return api
}

async function loadStore(initial) {
  const storage = fakeStorage(initial)
  globalThis.localStorage = storage
  vi.resetModules()
  const store = await import('./store.js')
  return { store, storage }
}

const seedTrip = {
  id: 'trip-1',
  createdAt: '2026-11-10T07:30:00.000Z',
  fromName: 'Mambaling',
  toName: 'IT Park',
  modeId: 'puj-traditional',
  modeName: 'Traditional Jeepney',
  roleId: 'student',
  roleLabel: 'Student',
  distanceKm: 6.97,
  fare: 15.96,
  gross: 19.95,
  discount: 3.99,
  legCount: 1,
}

beforeEach(() => {
  delete globalThis.localStorage
})

describe('fresh state', () => {
  it('starts at version 2 with a commuter session and seed data', async () => {
    const { store } = await loadStore()
    const state = store.getState()
    expect(state.version).toBe(2)
    expect(state.session).toEqual({ userId: 'local-commuter', role: 'commuter' })
    expect(state.matrix).toHaveLength(4)
    expect(state.trips.length).toBeGreaterThan(0)
    expect(state.admins).toHaveLength(1)
    expect(state.admins[0].role).toBe('admin')
    expect(state.audit).toEqual([])
    expect(state.confirms).toEqual({})
    expect(store.getStorageError()).toBeNull()
  })
})

describe('migration', () => {
  it('maps a v1 store into v2 and removes the old key', async () => {
    const { store, storage } = await loadStore({
      'farewise.v1': JSON.stringify({
        matrix: FARE_MATRIX_SEED,
        trips: [seedTrip],
        advisories: [],
        settings: { monthlyAllowance: 500 },
      }),
    })
    const state = store.getState()
    expect(state.version).toBe(2)
    expect(state.trips).toHaveLength(1)
    expect(state.settings.monthlyAllowance).toBe(500)
    expect(storage.has('farewise.v2')).toBe(true)
    expect(storage.has('farewise.v1')).toBe(false)
  })

  it('falls back to seed state when v2 is corrupt', async () => {
    const { store } = await loadStore({ 'farewise.v2': 'not json' })
    expect(store.getState().version).toBe(2)
    expect(store.getState().matrix).toHaveLength(4)
  })

  it('falls back to seed state when v2 has the wrong shape', async () => {
    const { store } = await loadStore({ 'farewise.v2': JSON.stringify({ matrix: 'x' }) })
    expect(store.getState().matrix).toHaveLength(4)
  })
})

describe('persistence failures', () => {
  it('keeps the change in memory and reports the failure', async () => {
    const { store, storage } = await loadStore()
    storage.failWrites = true
    store.actions.addTrip(seedTrip)
    expect(store.getState().trips[0].id).toBe('trip-1')
    expect(store.getStorageError()).toBeTruthy()
  })

  it('clears the message after a later successful write', async () => {
    const { store, storage } = await loadStore()
    storage.failWrites = true
    store.actions.addTrip(seedTrip)
    storage.failWrites = false
    store.actions.updateSettings({ monthlyAllowance: 1000 })
    expect(store.getStorageError()).toBeNull()
  })
})

describe('matrix editing', () => {
  it('adds a disabled draft row', async () => {
    const { store } = await loadStore()
    const id = store.actions.addMatrixRow()
    const row = store.getState().matrix.find((r) => r.id === id)
    expect(row.active).toBe(false)
    expect(billableRows(store.getState().matrix).map((r) => r.id)).not.toContain(id)
  })

  it('deactivates a row when its base fare is cleared', async () => {
    const { store } = await loadStore()
    store.actions.updateMatrixRow('puj-traditional', { base_fare: 0 })
    expect(store.getState().matrix.find((r) => r.id === 'puj-traditional').active).toBe(false)
  })

  it('restores seed values while keeping custom rows', async () => {
    const { store } = await loadStore()
    store.actions.deleteMatrixRow('puj-modern')
    const customId = store.actions.addMatrixRow()
    store.actions.restoreMatrixDefaults()

    const matrix = store.getState().matrix
    for (const seed of FARE_MATRIX_SEED) {
      const row = matrix.find((r) => r.id === seed.id)
      expect(row).toBeTruthy()
      expect(row.base_fare).toBe(seed.base_fare)
      expect(row.per_km).toBe(seed.per_km)
    }
    expect(matrix.find((r) => r.id === customId)).toBeTruthy()
  })

  it('refuses to delete the last billable row', async () => {
    const { store } = await loadStore()
    for (const row of store.getState().matrix.slice(1)) {
      store.actions.deleteMatrixRow(row.id)
    }
    expect(billableRows(store.getState().matrix)).toHaveLength(1)
    store.actions.deleteMatrixRow('puj-traditional')
    expect(store.getState().matrix).toHaveLength(1)
  })

  it('audits an admin edit with the previous values', async () => {
    const { store } = await loadStore()
    store.actions.adminUpdateMatrixRow('puj-traditional', { per_km: 2.5 })
    const audit = store.getState().audit
    expect(audit).toHaveLength(1)
    expect(audit[0].entity).toBe('rate')
    expect(audit[0].before.per_km).toBe(2.1)
    expect(audit[0].after.per_km).toBe(2.5)
  })

  it('does not audit a commuter-side matrix update', async () => {
    const { store } = await loadStore()
    store.actions.updateMatrixRow('puj-traditional', { per_km: 2.5 })
    expect(store.getState().audit).toHaveLength(0)
  })

  it('audits adding, deleting, and restoring rate rows', async () => {
    const { store } = await loadStore()
    const id = store.actions.addMatrixRow()
    store.actions.deleteMatrixRow(id)
    const count = store.actions.restoreMatrixDefaults()

    expect(count).toBe(FARE_MATRIX_SEED.length)
    const actionsSeen = store.getState().audit.map((entry) => entry.action)
    expect(actionsSeen).toEqual(['restore', 'delete', 'add'])
    expect(store.getState().audit[0].after.restored).toBe(FARE_MATRIX_SEED.length)
  })
})

describe('advisories', () => {
  it('confirms once per device', async () => {
    const { store } = await loadStore()
    const before = store.getState().advisories.find((a) => a.id === 'adv-1').confirms
    store.actions.confirmAdvisory('adv-1')
    store.actions.confirmAdvisory('adv-1')
    const after = store.getState().advisories.find((a) => a.id === 'adv-1').confirms
    expect(after).toBe(before + 1)
    expect(store.getState().confirms['adv-1']).toBe(true)
    expect(store.canConfirm(store.getState(), 'adv-1')).toBe(false)
  })

  it('audits a moderation decision', async () => {
    const { store } = await loadStore()
    store.actions.setAdvisoryStatus('adv-4', 'published')
    const audit = store.getState().audit
    expect(audit).toHaveLength(1)
    expect(audit[0].entity).toBe('advisory')
    expect(audit[0].after.status).toBe('published')
  })
})

describe('session', () => {
  it('elevates the local session and stamps the admin login', async () => {
    const { store } = await loadStore()
    store.actions.signInAdmin()
    const state = store.getState()
    expect(state.session.role).toBe('admin')
    expect(state.admins[0].lastLoginAt).toBeTruthy()
    expect(state.audit).toHaveLength(1)
  })

  it('returns to the commuter role on sign out', async () => {
    const { store } = await loadStore()
    store.actions.signInAdmin()
    store.actions.signOutAdmin()
    expect(store.getState().session.role).toBe('commuter')
  })
})

describe('import', () => {
  it('replaces the ledger but keeps the session and audit', async () => {
    const { store } = await loadStore()
    store.actions.adminUpdateMatrixRow('puj-traditional', { per_km: 2.1 })
    store.actions.signInAdmin()
    const result = store.actions.importState({
      matrix: FARE_MATRIX_SEED,
      trips: [seedTrip],
      advisories: [],
      settings: { monthlyAllowance: 700 },
    })
    expect(result.ok).toBe(true)
    const state = store.getState()
    expect(state.trips).toHaveLength(1)
    expect(state.settings.monthlyAllowance).toBe(700)
    expect(state.session.role).toBe('admin')
    expect(state.audit.length).toBeGreaterThan(0)
  })

  it('rejects a file without a matrix and changes nothing', async () => {
    const { store } = await loadStore()
    const before = store.getState()
    const result = store.actions.importState({ nope: true })
    expect(result.ok).toBe(false)
    expect(result.message).toBeTruthy()
    expect(store.getState()).toBe(before)
  })
})

describe('aggregateCounts', () => {
  it('counts pending advisories and never exposes trip rows', async () => {
    const { store } = await loadStore()
    const state = store.getState()
    const counts = store.aggregateCounts(state)
    expect(counts.pending).toBe(state.advisories.filter((a) => a.status === 'pending').length)
    expect(counts.admins).toBe(1)
    expect(counts.trips).toBe(state.trips.length)
    expect(counts.oldestRate).toBe('2026-11-01')
    expect(Object.keys(counts)).not.toContain('tripRows')
  })
})

describe('normaliseState', () => {
  it('returns null for a non-object', async () => {
    const { store } = await loadStore()
    expect(store.normaliseState(null)).toBeNull()
    expect(store.normaliseState('x')).toBeNull()
  })

  it('fills defaults for a minimal valid state', async () => {
    const { store } = await loadStore()
    const next = store.normaliseState({ matrix: [] })
    expect(next.version).toBe(2)
    expect(next.trips).toEqual([])
    expect(next.admins).toHaveLength(1)
    expect(next.session.role).toBe('commuter')
  })
})
