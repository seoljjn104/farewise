/**
 * Local-first data layer.
 *
 * The schema mirrors the tables named in the project charter — `fare_matrices`,
 * `trip_ledger`, `advisories` — so the persistence adapter can be swapped for a
 * Supabase client without touching a single component. For the localhost demo
 * everything lives in localStorage, which keeps the app free, offline-capable
 * and dependent on nobody's account.
 */
import { useSyncExternalStore } from 'react'
import { FARE_MATRIX_SEED } from './fares.js'
import { buildSeedTrips, ADVISORY_SEED, SETTINGS_SEED } from './seed.js'

const KEY = 'farewise.v1'

const initialState = () => ({
  matrix: FARE_MATRIX_SEED.map((r) => ({ ...r })),
  trips: buildSeedTrips(),
  advisories: ADVISORY_SEED.map((a) => ({ ...a })),
  settings: { ...SETTINGS_SEED },
})

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initialState()
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.matrix)) return initialState()
    return {
      matrix: parsed.matrix,
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
      advisories: Array.isArray(parsed.advisories) ? parsed.advisories : [],
      settings: { ...SETTINGS_SEED, ...(parsed.settings || {}) },
    }
  } catch {
    return initialState()
  }
}

let state = load()
const listeners = new Set()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('[farewise] could not persist state:', err.message)
  }
}

function commit(next) {
  state = next
  persist()
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

const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const actions = {
  /* ---------------------------------------------------------------- trips */
  addTrip(trip) {
    commit({ ...state, trips: [{ ...trip, id: trip.id || uid('trip') }, ...state.trips] })
  },
  deleteTrip(id) {
    commit({ ...state, trips: state.trips.filter((t) => t.id !== id) })
  },
  clearTrips() {
    commit({ ...state, trips: [] })
  },

  /* --------------------------------------------------------------- matrix */
  updateMatrixRow(id, patch) {
    commit({
      ...state,
      matrix: state.matrix.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })
  },
  addMatrixRow() {
    const row = {
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
    }
    commit({ ...state, matrix: [...state.matrix, row] })
    return row.id
  },
  deleteMatrixRow(id) {
    commit({ ...state, matrix: state.matrix.filter((r) => r.id !== id) })
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
    commit({
      ...state,
      advisories: state.advisories.map((a) => (a.id === id ? { ...a, status } : a)),
    })
  },
  confirmAdvisory(id) {
    commit({
      ...state,
      advisories: state.advisories.map((a) =>
        a.id === id ? { ...a, confirms: (a.confirms || 0) + 1 } : a
      ),
    })
  },
  deleteAdvisory(id) {
    commit({ ...state, advisories: state.advisories.filter((a) => a.id !== id) })
  },

  /* ------------------------------------------------------------- settings */
  updateSettings(patch) {
    commit({ ...state, settings: { ...state.settings, ...patch } })
  },

  /* ---------------------------------------------------------------- reset */
  resetAll() {
    commit(initialState())
  },
}

/* -------------------------------------------------------------- selectors */

export const publishedAdvisories = (s) => s.advisories.filter((a) => a.status === 'published')

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
