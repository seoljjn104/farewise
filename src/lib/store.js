/**
 * Local-first data layer with Supabase synchronization.
 *
 * The schema mirrors the tables named in the project charter — `fare_matrices`,
 * `trip_ledger`, `advisories`, `admin_users`, `audit_log` — so the persistence
 * adapter can be swapped for a Supabase client without touching a single
 * component. For the localhost demo everything lives in localStorage, which
 * keeps the app free, offline-capable and dependent on nobody's account.
 *
 * When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in the environment,
 * the store will synchronize state with Supabase instead of using localStorage.
 */
import { useSyncExternalStore } from 'react'
import { FARE_MATRIX_SEED, billableRows, sanitizeRateRow } from './fares.js'
import { buildSeedTrips, ADMIN_SEED, ADVISORY_SEED, SETTINGS_SEED } from './seed.js'

const KEY = 'farewise.v2'
const LEGACY_KEY = 'farewise.v1'
const AUDIT_CAP = 200

const seedSession = () => ({ userId: 'local-commuter', role: 'commuter' })

// Supabase client initialization
let supa = null
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (supabaseUrl && supabaseUrl !== 'your-supabase-project-url' && supabaseAnonKey && supabaseAnonKey !== 'your-supabase-anon-key') {
  supa = { url: supabaseUrl, key: supabaseAnonKey }
}

/**
 * Load initial state from Supabase or fall back to localStorage.
 */
export function initialState() {
  return {
    version: 2,
    session: seedSession(),
    matrix: FARE_MATRIX_SEED.map((r) => ({ ...r })),
    trips: buildSeedTrips(),
    advisories: ADVISORY_SEED.map((a) => ({ ...a })),
    confirms: {},
    admins: [{ ...ADMIN_SEED }],
    audit: [],
    settings: { ...SETTINGS_SEED },
  }
}

/**
 * Fetch state from Supabase, with localStorage fallback.
 */
async function loadFromSupabase() {
  if (!supa) return null
  try {
    // Try to fetch the most recent state row
    const response = await fetch(`${supa.url}/rest/v1/farewise_state?order=at.desc&limit=1`, {
      headers: {
        apikey: supa.key,
        Authorization: `Bearer ${supa.key}`,
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) return null
    const data = await response.json()
    if (data && data.length > 0) {
      return normaliseState(data[0])
    }
    return null
  } catch {
    return null
  }
}

/**
 * Save state to Supabase.
 */
async function saveToSupabase(state) {
  if (!supa) return false
  try {
    await fetch(`${supa.url}/rest/v1/farewise_state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supa.key,
        Authorization: `Bearer ${supa.key}`,
      },
      body: JSON.stringify({
        ...state,
        updatedAt: new Date().toISOString(),
      }),
    })
    return true
  } catch {
    return false
  }
}

function normaliseSession(input) {
  const role = input?.role === 'admin' ? 'admin' : 'commuter'
  return { userId: input?.userId || 'local-commuter', role }
}

/**
 * Coerce anything that claims to be a FareWise state into a complete v2 state.
 * Returns null when the shape is unusable, so callers can leave data untouched.
 */
export function normaliseState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  if (!Array.isArray(input.matrix)) return null
  if (input.trips !== undefined && !Array.isArray(input.trips)) return null
  if (input.advisories !== undefined && !Array.isArray(input.advisories)) return null

  return {
    version: 2,
    session: normaliseSession(input.session),
    matrix: input.matrix.filter((r) => r && typeof r === 'object').map(sanitizeRateRow),
    trips: Array.isArray(input.trips) ? input.trips : [],
    advisories: Array.isArray(input.advisories) ? input.advisories : [],
    confirms: input.confirms && typeof input.confirms === 'object' ? { ...input.confirms } : {},
    admins:
      Array.isArray(input.admins) && input.admins.length
        ? input.admins
        : [{ ...ADMIN_SEED }],
    audit: Array.isArray(input.audit) ? input.audit : [],
    settings: {
      ...SETTINGS_SEED,
      ...(input.settings && typeof input.settings === 'object' ? input.settings : {}),
    },
  }
}

function load() {
  // Try Supabase first if configured
  if (supa) {
    const supaState = loadFromSupabase()
    if (supaState) return supaState
  }

  // Fall back to localStorage
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const normalised = normaliseState(parsed)
      if (normalised) return normalised
    }

    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const migrated = normaliseState(JSON.parse(legacy))
      if (migrated) {
        try {
          localStorage.setItem(KEY, JSON.stringify(migrated))
          localStorage.removeItem(LEGACY_KEY)
        } catch {
          /* the first successful commit will retry the write */
        }
        return migrated
      }
    }
  } catch {
    return initialState()
  }
  return initialState()
}

let state = load()
let storageError = null
const listeners = new Set()

function persist(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
    storageError = null
    // Also try Supabase if configured
    if (supa) {
      saveToSupabase(next).catch(() => {
        // Supabase write failure is non-fatal for local demo
      })
    }
    return true
  } catch {
    storageError = 'Changes are not being saved on this device. Export your data before closing.'
    return false
  }
}

function commit(next) {
  state = next
  persist(next)
  listeners.forEach((l) => l())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => state

/** Whole-store hook. The snapshot reference only changes on commit, so this is safe. */
export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export const getState = getSnapshot

/** Persistent storage failure, for the banner in the shell. */
export function useStorageError() {
  return useSyncExternalStore(subscribe, () => storageError, () => storageError)
}

export const getStorageError = () => storageError

const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

function auditEntry(action, entity, entityId, before, after) {
  return {
    id: uid('audit'),
    at: new Date().toISOString(),
    action,
    entity,
    entityId,
    before: before ?? null,
    after: after ?? null,
  }
}

function withAudit(next, entry) {
  return { ...next, audit: [entry, ...next.audit].slice(0, AUDIT_CAP) }
}

export const actions = {
  /* ---------------------------------------------------------------- trips */
  addTrip(trip) {
    commit({ ...state, trips: [{ ...trip, id: trip.id || uid('trip') }, ...state.trips] })
  },
  deleteTrip(id) {
    commit({ ...state, trips: state.trips.filter((t) => t.id !== id) })
  },
  restoreTrip(trip, index = 0) {
    if (!trip) return
    const trips = [...state.trips]
    const at = Math.min(Math.max(0, Number(index) || 0), trips.length)
    trips.splice(at, 0, trip)
    commit({ ...state, trips })
  },
  clearTrips() {
    commit({ ...state, trips: [] })
  },

  /* --------------------------------------------------------------- matrix */
  updateMatrixRow(id, patch) {
    commit({
      ...state,
      matrix: state.matrix.map((r) => (r.id === id ? sanitizeRateRow({ ...r, ...patch }) : r)),
    })
  },
  adminUpdateMatrixRow(id, patch) {
    const before = state.matrix.find((r) => r.id === id)
    if (!before) return
    const after = sanitizeRateRow({ ...before, ...patch })
    const matrix = state.matrix.map((r) => (r.id === id ? after : r))
    commit(
      withAudit({ ...state, matrix }, auditEntry('update', 'rate', id, { ...before }, { ...after }))
    )
  },
  addMatrixRow() {
    const row = sanitizeRateRow({
      id: uid('mode'),
      code: 'NEW',
      mode: 'New Vehicle Class',
      base_fare: 0,
      base_km: 4,
      per_km: 0,
      discount_pct: 20,
      effective_from: new Date().toISOString().slice(0, 10),
      source: 'Manually entered via Admin Control Panel',
      active: true,
    })
    commit(
      withAudit(
        { ...state, matrix: [...state.matrix, row] },
        auditEntry('add', 'rate', row.id, null, { ...row })
      )
    )
    return row.id
  },
  deleteMatrixRow(id) {
    const row = state.matrix.find((r) => r.id === id)
    if (!row) return
    const remaining = state.matrix.filter((r) => r.id !== id)
    // A store with no billable row cannot price anything. Keep the last one.
    if (billableRows(remaining).length === 0) return
    commit(
      withAudit(
        { ...state, matrix: remaining },
        auditEntry('delete', 'rate', id, { ...row }, null)
      )
    )
  },
  restoreMatrixDefaults() {
    const seedIds = new Set(FARE_MATRIX_SEED.map((r) => r.id))
    const custom = state.matrix
      .filter((r) => !seedIds.has(r.id))
      .map((r) => sanitizeRateRow(r))
    const restored = FARE_MATRIX_SEED.map((r) => ({ ...r }))
    commit(
      withAudit(
        { ...state, matrix: [...restored, ...custom] },
        auditEntry('restore', 'rate', 'matrix', null, { restored: restored.length })
      )
    )
    return restored.length
  },

  /* ----------------------------------------------------------- advisories */
  addAdvisory(advisory) {
    const row = {
      id: uid('adv'),
      createdAt: new Date().toISOString(),
      status: 'pending',
      confirms: 0,
      author: 'Community',
      severity: 'medium',
      ...advisory,
    }
    commit({ ...state, advisories: [row, ...state.advisories] })
    return row.id
  },
  setAdvisoryStatus(id, status) {
    const before = state.advisories.find((a) => a.id === id)
    if (!before) return
    const advisories = state.advisories.map((a) => (a.id === id ? { ...a, status } : a))
    commit(
      withAudit(
        { ...state, advisories },
        auditEntry('status', 'advisory', id, { status: before.status }, { status })
      )
    )
  },
  confirmAdvisory(id) {
    if (!canConfirm(state, id)) return
    const advisories = state.advisories.map((a) =>
      a.id === id ? { ...a, confirms: (a.confirms || 0) + 1 } : a
    )
    commit({ ...state, advisories, confirms: { ...state.confirms, [id]: true } })
  },
  deleteAdvisory(id) {
    commit({ ...state, advisories: state.advisories.filter((a) => a.id !== id) })
  },

  /* ------------------------------------------------------------- settings */
  updateSettings(patch) {
    commit({ ...state, settings: { ...state.settings, ...patch } })
  },

  /* ------------------------------------------------------------- session */
  signInAdmin() {
    const at = new Date().toISOString()
    const admins = state.admins.map((a, i) => (i === 0 ? { ...a, lastLoginAt: at } : a))
    commit(
      withAudit(
        { ...state, session: { ...state.session, role: 'admin' }, admins },
        auditEntry('sign-in', 'session', state.session.userId, { role: state.session.role }, {
          role: 'admin',
        })
      )
    )
  },
  signOutAdmin() {
    commit(
      withAudit(
        { ...state, session: { ...state.session, role: 'commuter' } },
        auditEntry('sign-out', 'session', state.session.userId, { role: 'admin' }, {
          role: 'commuter',
        })
      )
    )
  },

  /* ---------------------------------------------------------------- data */
  importState(parsed) {
    const next = normaliseState(parsed)
    if (!next) {
      return { ok: false, message: 'That file is not a FareWise backup.' }
    }
    commit({
      ...state,
      version: 2,
      matrix: next.matrix,
      trips: next.trips,
      advisories: next.advisories,
      confirms: next.confirms,
      settings: next.settings,
    })
    return {
      ok: true,
      message: `Imported ${next.trips.length} trips and ${next.advisories.length} advisories.`,
    }
  },

  /* ---------------------------------------------------------------- reset */
  resetAll() {
    commit(initialState())
  },
}

/* -------------------------------------------------------------- selectors */

export const publishedAdvisories = (s) => s.advisories.filter((a) => a.status === 'published')

export function canConfirm(s, id) {
  if (!id) return false
  if (s.confirms?.[id]) return false
  return s.advisories.some((a) => a.id === id)
}

export function monthTrips(s, ref = new Date()) {
  const y = ref.getFullYear()
  const m = ref.getMonth()
  return s.trips.filter((t) => {
    const d = new Date(t.createdAt)
    return d.getFullYear() === y && d.getMonth() === m
  })
}

export const totalsFor = (trips) => ({
  count: trips.length,
  spent: Math.round(trips.reduce((a, t) => a + (Number(t.fare) || 0), 0) * 100) / 100,
  km: Math.round(trips.reduce((a, t) => a + (Number(t.distanceKm) || 0), 0) * 100) / 100,
  saved: Math.round(trips.reduce((a, t) => a + (Number(t.discount) || 0), 0) * 100) / 100,
})

/**
 * Counts only. The admin console must never receive a trip row, a route name,
 * or anything else that identifies a commuter.
 */
export function aggregateCounts(s) {
  const dates = s.matrix
    .map((r) => r.effective_from)
    .filter(Boolean)
    .sort()
  return {
    commuters: 1,
    admins: s.admins.length,
    trips: s.trips.length,
    advisories: s.advisories.length,
    pending: s.advisories.filter((a) => a.status === 'pending').length,
    oldestRate: dates[0] ?? null,
    newestRate: dates[dates.length - 1] ?? null,
  }
}