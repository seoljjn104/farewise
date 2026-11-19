/**
 * Geospatial layer.
 *
 * Primary: OSRM demo router (free, no key) for real road distance and geometry.
 * Fallback: great-circle distance scaled by an urban road-winding factor, so the
 * demo keeps working with no network at all.
 */

export const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving/'

/** Measured against the Colon St → IT Park OSRM result (4.28 km straight, 5.51 km road). */
export const ROAD_FACTOR = 1.28

const R = 6371.0088

export function haversineKm(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Straight-line fallback that still produces a per-leg breakdown. */
function estimate(points) {
  const legs = []
  const path = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    path.push([p.lat, p.lng])
    if (i === 0) continue
    const a = points[i - 1]
    const straight = haversineKm(a, p)
    const km = straight * ROAD_FACTOR
    legs.push({ km: round(km), min: round((km / 18) * 60, 1) }) // ≈18 km/h Metro Cebu urban mean
  }
  return {
    source: 'estimate',
    legs,
    path,
    km: round(legs.reduce((sum, leg) => sum + leg.km, 0)),
    min: round(legs.reduce((sum, leg) => sum + leg.min, 0), 1),
  }
}

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d

/**
 * Route through an ordered list of waypoints.
 * @param {Array<{lat:number,lng:number}>} points at least two
 * @param {{signal?:AbortSignal, timeoutMs?:number}} opts
 * @returns {Promise<{source:'osrm'|'estimate', legs:Array<{km:number,min:number}>, path:Array<[number,number]>, km:number, min:number}>}
 */
export async function fetchRoute(points, { signal, timeoutMs = 7000 } = {}) {
  if (!points || points.length < 2) {
    return { source: 'estimate', legs: [], path: [], km: 0, min: 0 }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true })

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `${OSRM_BASE}${coords}?overview=full&geometries=geojson&steps=false`

  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error('OSRM HTTP ' + res.status)
    const json = await res.json()
    const route = json.routes && json.routes[0]
    if (!route) throw new Error('OSRM returned no route')

    const legs = (route.legs || []).map((l) => ({
      km: round(l.distance / 1000),
      min: round(l.duration / 60, 1),
    }))
    const path = (route.geometry?.coordinates || []).map((c) => [c[1], c[0]])

    return {
      source: 'osrm',
      legs,
      path,
      km: round(route.distance / 1000),
      min: round(route.duration / 60, 1),
    }
  } catch (err) {
    // The caller cancelled (waypoints changed) — propagate so the stale result
    // is discarded rather than replaced with an offline estimate.
    if (signal?.aborted) throw err
    console.warn('[farewise] OSRM unavailable, using offline estimate:', err.message)
    return estimate(points)
  } finally {
    clearTimeout(timer)
  }
}

export const boundsOf = (points) => points.map((p) => [p.lat, p.lng])
