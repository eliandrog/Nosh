// Helpers for Free meals nearby. Meals repeat weekly: weekday 0 = Monday … 6 = Sunday (as the API sends them).
import type { PlaceMeal, PlaceType } from '../api/types'
import { addDays, parseIsoDate } from './dates'
import type { IsoDate } from './dates'

/** Demo area used when the browser can't share the user's location. */
export const FALLBACK_LOCATION = { lat: 51.4613, lng: -0.1149, label: 'Brixton' } as const

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

/** Monday-based weekday (0–6) of a local date. */
export const weekdayOf = (iso: IsoDate): number => (parseIsoDate(iso).getDay() + 6) % 7

/** The next date (today included) that falls on `weekday`. */
export function nextDateForWeekday(from: IsoDate, weekday: number): IsoDate {
  return addDays(from, (weekday - weekdayOf(from) + 7) % 7)
}

/** "12:00:00" -> "12:00" */
export const shortTime = (time: string): string => time.slice(0, 5)

/** "Wednesdays 12:00 – 14:00" */
export const mealTimes = (meal: PlaceMeal): string =>
  `${WEEKDAY_NAMES[meal.weekday]}s ${shortTime(meal.startTime)} – ${shortTime(meal.endTime)}`

const TYPE_LABELS: Record<PlaceType, string> = {
  community_kitchen: 'Community kitchen',
  cafe: 'Café',
  food_hub: 'Food hub',
}
export const placeTypeLabel = (type: PlaceType): string => TYPE_LABELS[type]

/** "0.3 km" (one decimal), "120 m" under 0.1 km. */
export function distanceLabel(km: number | null): string {
  if (km === null) return ''
  return km < 0.1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

/** "Serves 1" plus the place's own note when it has one, e.g. "Serves 4 · feeds 4 for about 3 days". */
export const servesLabel = (meal: PlaceMeal): string =>
  meal.servesNote ? `Serves ${meal.serves} · ${meal.servesNote}` : `Serves ${meal.serves}`

/** External walking directions (no in-app routing). */
export const directionsUrl = (lat: number, lng: number): string =>
  `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=%3B${lat}%2C${lng}`
