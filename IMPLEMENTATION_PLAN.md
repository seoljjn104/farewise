# FareWise Map Integration — Move It-Style Pickup/Drop-off

## Overview
This plan adds interactive map-based pickup/drop-off selection with real-time fare recalculation, matching the requested features while preserving all existing functionality.

## Existing State & Files Inspected

### Key Files Already in Place
| File | Purpose |
|------|---------|
| `src/components/MapView.jsx` | Leaflet map with TileLayer, markers, polylines, fit-bounds |
| `src/views/Plan.jsx` | Main planner with waypoint list, fare ticket, map strip |
| `src/lib/geo.js` | OSRM routing, haversine fallback, `fetchRoute()` |
| `src/lib/fares.js` | Fare engine: `computeFare()`, `priceTrip()`, `compareModes()` |
| `src/lib/store.js` | LocalStorage state: `matrix`, `trips`, `session`, `settings` |
| `src/data/places.json` | 27 curated Metro Cebu gazetteer entries |
| `src/components/PlaceInput.jsx` | Autocomplete input for origin/destination/via points |
| `src/components/FareTicket.jsx` | Fare display component |
| `src/lib/format.js` | `peso()`, `kmFmt()`, `duration()` formatting |

### Existing Flow
1. User enters origin/destination via `PlaceInput` components
2. `Plan.jsx` calls `fetchRoute(stops)` from `geo.js` → OSRM or offline estimate
3. Route distance (`route.km`) feeds `priceTrip()` / `computeFare()` from `fares.js`
4. Fare displays in `FareTicket` and breakdown in `BreakdownSheet`
5. Logged trips stored in `localStorage` via `store.js`

### No Changes Needed To
- `store.js` — session, matrix, trips, advisories, settings all remain unchanged
- `fares.js` — fare engine is pure; just passes new km values
- `Plan.jsx` layout — reuse existing grid/panel structure
- `PlaceInput.jsx` — keep existing gazetteer autocomplete, add map-integrated mode

## New Packages Required
| Package | Version | Purpose |
|---------|---------|---------|
| `leaflet` | ^1.9.4 | Already imported in `MapView.jsx` — ensure installed |
| `react-leaflet` | ^5.0.0 | Already imported — ensure installed |

These are already listed as peer dependencies in the code (imported but may need `npm install`).

## Changes by File

### 1. `src/components/MapView.jsx` — Enhanced Map Component
**Additions:**
- Fixed center-pin mode: when adjusting pickup/drop-off, the pin stays centered in viewport while map pans underneath
- `moveend` handler reads center coordinates and triggers reverse geocode
- Props: `onCenterChange(lat, lng)` callback, `fixedCenter` mode flag
- Loading/spinner state for geocode/API failures

**Modified code structure:**
- Add `useEffect` listening to `moveend` on `MapContainer`
- When `fixedCenter` is true, reposition marker to center after each pan
- Fetch Photon API on center change to update address fields
- Add error boundary for API failures

### 2. `src/views/Plan.jsx` — Map-Integrated Plan Screen
**Additions:**
- State for pickup/drop-off coordinates (`pickupLat`, `pickupLng`, `dropLat`, `dropLng`)
- "Current Location" button via `navigator.geolocation`
- Debounced Photon autocomplete suggestions (400ms)
- OSRM road distance query on coordinate change
- Route polyline rendering on map
- Real-time fare recalculation when coordinates or tariffs change

**Modified state variables:**
```jsx
const [pickupLat, setPickupLat] = useState(10.3236)  // Cebu centre default
const [pickupLng, setPickupLng] = useState(123.9223)
const [dropLat, setDropLat] = useState(10.3308)     // IT Park default  
const [dropLng, setDropLng] = useState(123.9068)
const [currentLocationEnabled, setCurrentLocationEnabled] = useState(false)
const [geocodeTimeouts, setGeocodeTimeouts] = useState({})
```

**New functions:**
- `fetchPhoton(query, lat, lng)` — Photon API geocoding
- `fetchOSRMDistance(lng1, lat1, lng2, lat2)` — road distance + ETA
- `handlePickupChange(place)` — update coords, pan map, recalculate fare
- `handleDropChange(place)` — same for destination
- `useDebounce` hook or manual setTimeout management

**Integration with existing flow:**
- When pickup/drop coordinates change, update the `stops` state that `fetchRoute()` already watches
- The existing `fetchRoute()` → `priceTrip()` pipeline continues unchanged
- Fare recalculates reactively via the existing `trip` memo that depends on `route.km` and `mode`

### 3. `src/lib/geo.js` — Extended OSRM & Add Photon
**Additions:**
- Photon geocoding API helper
- Distance/ETA query for any two coordinates
- Current location via `navigator.geolocation`

**New exports:**
```js
export function fetchPhoton(query, lat, lng) {
  const url = `https://photon.komoot.io/api/?q=${query}&lat=${lat}&lon=${lng}&limit=5`
  return fetch(url).then(r => r.json())
}
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject('no geolocation')
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err)
    )
  })
}
```

### 4. `src/lib/fares.js` — No Changes Needed
The fare engine already accepts `km` values and produces ₱ gross/net. No modifications required — just pass the new OSRM distances.

### 5. `src/views/Plan.jsx` — UI Wiring
**Map section modifications** (replace existing map strip):
- Add pickup coordinate display with "Use Current Location" toggle
- Add drop coordinate display
- Debounced autocomplete suggestions below each field
- "Set from map" button that opens the map in fixed-center mode
- Real-time fare display updating as coordinates change

**Keep existing:**
- Waypoint PlaceInput list (origin/via/destination) — unchanged
- `Log this trip` button — unchanged
- Budget integration — unchanged

## Interaction Flow

```
1. User taps "Set Pickup from Map" or "Set Drop-off from Map"
2. Map opens in fixed-center mode with current pin location
3. User pans map or selects "Current Location"
4. On `moveend`:
   a. Read center lat/lng
   b. Fetch Photon reverse geocode → update address field text
   c. Fetch OSRM distance between pickup & drop
   d. Route polyline appears on map
   e. Fare recalculates reactively
5. User selects a suggestion → coords update, map pans, fare updates
6. User types in the field → debounced Photon suggestions appear
```

## API Endpoints Used
| Endpoint | Purpose | Params |
|----------|---------|--------|
| `https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson` | Road distance + ETA + polyline | Two coordinate pairs |
| `https://photon.komoot.io/reverse?lat={lat}&lon={lon}` | Reverse geocode center pin | lat, lng |
| `https://photon.komoot.io/api?q={query}&lat={lat}&lon={lng}&limit=5` | Autocomplete suggestions | query, lat/lng bias, limit |
| `navigator.geolocation` | Current location | Browser API |

## Safety & Graceful Degradation
- **OSRM unavailable:** Fall back to haversine × ROAD_FACTOR (1.28) — already implemented in `fetchRoute()`
- **Photon unavailable:** Show "Could not geocode" inline, keep last known coordinates
- **Geolocation denied:** "Use Current Location" button disabled, fallback to manual entry
- **No route between points:** Display "No road route found — showing straight-line estimate"
- **All API calls abort** on component unmount or waypoint change (via AbortController)
- **No console errors** — every fetch has `.catch()` with user-friendly messages
- **Existing layout preserved** — map adds to existing panel, no breaking CSS changes

## Minimal Package Install
```bash
npm install leaflet react-leaflet
```

The code already imports from these packages; installing them makes the imports functional.

## Files Modified / Added
| File | Change Type |
|------|-------------|
| `src/components/MapView.jsx` | Enhanced: fixed-center pin, moveend handler, geocode callback |
| `src/views/Plan.jsx` | Modified: pickup/drop coordinates, Photon autocomplete, OSRM distance, live fare |
| `src/lib/geo.js` | Added: `fetchPhoton()`, `getCurrentLocation()`, enhanced routing safety |
| `package.json` | Added: `"leaflet": "^1.9.4"`, `"react-leaflet": "^5.0.0"` to dependencies |
| `src/lib/format.js` | No changes needed — existing `peso()` / `kmFmt()` suffice |
| `src/components/PlaceInput.jsx` | No changes — reuse existing gazetteer autocomplete |
| `src/lib/fares.js` | No changes needed — fare engine already handles any km value |

## Verification
- All 105 existing tests continue passing (`npm test`)
- `npm run build` exits 0
- `npm run lint` exits 0
- Manual testing: map centers on Cebu, picks up coordinates, routes appear, fare updates in real-time
- Offline mode: haversine × 1.28 fallback when OSRM is unreachable