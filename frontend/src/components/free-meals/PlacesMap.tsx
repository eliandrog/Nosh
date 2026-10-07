import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import type { Place } from '../../api/types'

type LatLng = { lat: number; lng: number }

type PlacesMapProps = {
  center: LatLng
  /** Shown as the teal "you are here" dot only when it's the device location. */
  you: LatLng | null
  places: Place[]
  selectedId: number | null
  onSelect: (id: number) => void
}

// Brand pins as inline SVG (no default marker images): Coral places, Charcoal selected, Teal "you".
const pinSvg = (fill: string) =>
  `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M15 39s13-14 13-24A13 13 0 0 0 2 15c0 10 13 24 13 24Z" fill="${fill}" stroke="#ffffff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#ffffff"/></svg>`
const placeIcon = L.divIcon({ html: pinSvg('#f3764b'), className: 'map-pin', iconSize: [30, 40], iconAnchor: [15, 39] })
const selectedIcon = L.divIcon({ html: pinSvg('#2e373e'), className: 'map-pin map-pin--selected', iconSize: [30, 40], iconAnchor: [15, 39] })
const youIcon = L.divIcon({
  html: '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#3aa58f" fill-opacity="0.25"/><circle cx="12" cy="12" r="6" fill="#3aa58f" stroke="#ffffff" stroke-width="2.5"/></svg>',
  className: 'map-you',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

/** Keeps the map centred on the search point, and pans to the selected place. */
function FollowSelection({ center, selected }: { center: LatLng; selected: Place | undefined }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom())
  }, [map, center.lat, center.lng])
  useEffect(() => {
    if (selected) map.panTo([selected.latitude, selected.longitude])
  }, [map, selected])
  return null
}

/** Pale map (CARTO Positron) with a pin per place; the list in the panel below is the text alternative. */
export function PlacesMap({ center, you, places, selectedId, onSelect }: PlacesMapProps) {
  const selected = places.find((p) => p.id === selectedId)
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={15} scrollWheelZoom={false} className="places-map">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution="© OpenStreetMap contributors © CARTO"
      />
      <FollowSelection center={center} selected={selected} />
      {you && <Marker position={[you.lat, you.lng]} icon={youIcon} title="You are here" alt="You are here" keyboard={false} />}
      {places.map((p) => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={p.id === selectedId ? selectedIcon : placeIcon}
          title={p.name}
          alt={p.name}
          zIndexOffset={p.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(p.id) }}
        />
      ))}
    </MapContainer>
  )
}
