import { describe, expect, it } from 'vitest'
import type { PlaceMeal } from '../api/types'
import { distanceLabel, mealTimes, nextDateForWeekday, servesLabel, weekdayOf } from './places'

const meal = (overrides: Partial<PlaceMeal> = {}): PlaceMeal => ({
  id: 1,
  name: 'Vegetable curry with rice',
  kind: 'hot',
  weekday: 2,
  startTime: '12:00:00',
  endTime: '14:00:00',
  serves: 1,
  servesNote: null,
  dietary: [],
  openToday: false,
  ...overrides,
})

describe('places helpers', () => {
  it('uses Monday-based weekdays like the API', () => {
    expect(weekdayOf('2026-10-05')).toBe(0) // Monday
    expect(weekdayOf('2026-10-11')).toBe(6) // Sunday
  })

  it('finds today or the next date on a weekday', () => {
    const wed = '2026-10-07'
    expect(nextDateForWeekday(wed, 2)).toBe('2026-10-07') // served today
    expect(nextDateForWeekday(wed, 3)).toBe('2026-10-08') // tomorrow, Thursday
    expect(nextDateForWeekday(wed, 0)).toBe('2026-10-12') // next Monday
  })

  it('formats times, distances and servings for people', () => {
    expect(mealTimes(meal())).toBe('Wednesdays 12:00 – 14:00')
    expect(distanceLabel(0.03)).toBe('30 m')
    expect(distanceLabel(0.25)).toBe('0.3 km')
    expect(distanceLabel(null)).toBe('')
    expect(servesLabel(meal({ serves: 4, servesNote: 'feeds 4 for about 3 days' }))).toBe('Serves 4 · feeds 4 for about 3 days')
    expect(servesLabel(meal())).toBe('Serves 1')
  })
})
