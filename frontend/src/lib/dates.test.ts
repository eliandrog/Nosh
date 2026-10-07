import { describe, expect, it } from 'vitest'
import { addDays, dayLabel, isValidIsoDate, mondayOf, relativeWeekLabel, toIsoDate, weekRangeLabel } from './dates'

describe('dates', () => {
  it('uses the local calendar date, not UTC', () => {
    expect(toIsoDate(new Date(2026, 9, 7, 23, 59))).toBe('2026-10-07') // late evening stays on the same day
  })

  it('finds the Monday of any day, including across months and from Sunday', () => {
    expect(mondayOf('2026-10-07')).toBe('2026-10-05')
    expect(mondayOf('2026-10-11')).toBe('2026-10-05') // Sunday belongs to the week before
    expect(mondayOf('2026-10-01')).toBe('2026-09-28')
    expect(addDays('2026-10-05', -7)).toBe('2026-09-28')
  })

  it('formats British labels for days and week ranges', () => {
    expect(dayLabel('2026-10-07')).toBe('Wed 7 Oct')
    expect(weekRangeLabel('2026-10-05')).toBe('5 – 11 October')
    expect(weekRangeLabel('2026-09-28')).toBe('28 September – 4 October')
  })

  it('names nearby weeks', () => {
    expect(relativeWeekLabel('2026-10-05', '2026-10-07')).toBe('This week')
    expect(relativeWeekLabel('2026-10-12', '2026-10-07')).toBe('Next week')
    expect(relativeWeekLabel('2026-09-28', '2026-10-07')).toBe('Last week')
    expect(relativeWeekLabel('2026-10-26', '2026-10-07')).toBe('')
  })

  it('only accepts real YYYY-MM-DD dates from the URL', () => {
    expect(isValidIsoDate('2026-10-07')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('next-week')).toBe(false)
    expect(isValidIsoDate(null)).toBe(false)
  })
})
