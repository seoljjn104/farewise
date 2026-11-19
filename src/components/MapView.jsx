import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet'

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

/* ------------------------------------------------------------------ pins -- */

function pinIcon(label, bg, fg, border) {
  return L.divIcon({
    className: 'fw-pin',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
    html: `<div style="width:30px;height:30px;border-radius:10px;display:flex;align-items:center;
      justify-content:center;background:${bg};color:${fg};border:2px solid ${border};
      font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;letter-spacing:-.02em;
      box-shadow:0 6px 18px rgba(0,0,0,.6),0 0 0 3px rgba(10,14,19,.9);">${label}</div>`,
  })
}

/* --------------------------------------------------------------- helpers -- */

function Fit({ points }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    if (!points || points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: false })
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 15.5, animate: false })
  }, [key, map])
  return null
}

function ZoomCtl({ position = 'bottomright' }) {
  const map = useMap()
  useEffect(() => {
    const ctrl = L.control.zoom({ position })
    ctrl.addTo(map)
    return () => ctrl.remove()
  }, [map, position])
  return null
}

/* ------------------------------------------------------------------ map --- */

export default function MapView({
  stops = [],
  path = [],
  tileStyle = 'dark',
  className = '',
  interactive = true,
}) {
  const center = useMemo(() => {
    if (path.length) return path[Math.floor(path.length / 2)]
    if (stops.length) return [stops[0].lat, stops[0].lng]
    return [10.3157, 123.9057] // Cebu City centre
  }, [path, stops])

  const markers = useMemo(() => {
    const last = stops.length - 1
    return stops.map((s, i) => {
      if (i === 0) return { s, i, icon: pinIcon('A', '#FFC42E', '#241C05', '#FFD976') }
      if (i === last) return { s, i, icon: pinIcon('B', '#3DDC97', '#062015', '#7BF0BE') }
      return { s, i, icon: pinIcon(String(i), '#12171F', '#EEF2F6', '#4A5563') }
    })
  }, [stops])

  return (
    <div className={`relative isolate ${className}`}>
      <MapContainer
        center={center}
        zoom={13}
        zoomControl={false}
        scrollWheelZoom={interactive}
        dragging={interactive}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          url={OSM_TILES}
          attribution={OSM_ATTR}
          maxZoom={19}
          className={tileStyle === 'dark' ? 'fw-tiles-dark' : ''}
        />

        {path.length > 1 && (
          <>
            <Polyline positions={path} pathOptions={{ color: '#3DDC97', weight: 11, opacity: 0.16, lineCap: 'round' }} />
            <Polyline positions={path} pathOptions={{ color: '#3DDC97', weight: 3.5, opacity: 0.95, lineCap: 'round' }} />
          </>
        )}

        {markers.map(({ s, i, icon }) => (
          <Marker key={s.id || i} position={[s.lat, s.lng]} icon={icon} />
        ))}

        <Fit points={[...stops.map((s) => [s.lat, s.lng]), ...path]} />
        <ZoomCtl />
      </MapContainer>
    </div>
  )
}
