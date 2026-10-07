import { useEffect, useState } from 'react'
import { FALLBACK_LOCATION } from '../lib/places'

export type LocationState =
  | { status: 'locating' }
  /** `source: 'fallback'` = the browser couldn't (or wasn't allowed to) share the location. */
  | { status: 'ready'; lat: number; lng: number; source: 'device' | 'fallback' }

const FALLBACK: LocationState = { status: 'ready', lat: FALLBACK_LOCATION.lat, lng: FALLBACK_LOCATION.lng, source: 'fallback' }

/** Asks the browser for the user's location once; falls back to the demo area if denied or unavailable. */
export function useLocation(timeoutMs = 8000): LocationState {
  const supported = typeof navigator !== 'undefined' && !!navigator.geolocation
  const [state, setState] = useState<LocationState>(supported ? { status: 'locating' } : FALLBACK)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (pos) => !cancelled && setState({ status: 'ready', lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'device' }),
      () => !cancelled && setState(FALLBACK),
      { timeout: timeoutMs, maximumAge: 5 * 60_000 },
    )
    return () => {
      cancelled = true
    }
  }, [supported, timeoutMs])

  return state
}
