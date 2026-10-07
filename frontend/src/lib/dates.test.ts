import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  dayLabel,
  isValidIsoDate,
  mondayOf,
  monthGrid,
  monthLabel,
  relativeWeekLabel,
  shortWeekRangeLabel,
  toIsoDate,
  weekRangeLabel,
} from './dates'

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

describe('month calendar helpers', () => {
  it('builds Monday-first weeks that cover the whole month', () => {
    const weeks = monthGrid('2026-09') // 1 Sep 2026 is a Tuesday, 30 Sep a Wednesday
    expect(weeks[0][0]).toBe('2026-08-31')
    expect(weeks.at(-1)?.at(-1)).toBe('2026-10-04')
    expect(weeks).toHaveLength(5)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })

  it('moves between months across year ends', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(monthLabel('2026-09')).toBe('September 2026')
  })

  it('labels a week compactly, including across months', () => {
    expect(shortWeekRangeLabel('2026-09-21')).toBe('21 – 27 Sept')
    expect(shortWeekRangeLabel('2026-09-28')).toBe('28 Sept – 4 Oct')
  })
})
