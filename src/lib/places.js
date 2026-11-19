/* Place search helpers, built from the curated Metro Cebu gazetteer.
   Use findPlace(name) → best match or null.
   Use allPlaces → the full curated list.
   Use placeIndex[term] → places whose name/city/kind contains that term.
*/
import places from '../data/places.json'

// The full list of curated Metro Cebu locations (id/name/city/kind/lat/lng).
export const allPlaces = places

const byId = Object.fromEntries(places.map((p) => [p.id, p]))

export const getPlaceById = (id) => byId[id] || null

/** Lower-case token → places that mention it in their name, city or kind. */
export const placeIndex = (() => {
  const index = {}
  for (const p of places) {
    for (const field of [p.name, p.city, p.kind]) {
      for (const token of field.toLowerCase().split(/[^a-z0-9']+/)) {
        if (!token) continue
        if (!index[token]) index[token] = []
        if (!index[token].includes(p)) index[token].push(p)
      }
    }
  }
  return index
})()

// Exact (or best-effort) place lookup by name.
export function findPlace(name) {
  if (!name) return null
  const lowered = name.toLowerCase().trim()
  const hits = placeIndex[lowered]
  if (hits && hits.length) return hits[0]
  for (const p of places) {
    if (p.name.toLowerCase().includes(lowered)) return p
  }
  return null
}
