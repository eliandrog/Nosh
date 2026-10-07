// Calendar dates as "YYYY-MM-DD" strings in the user's LOCAL time (never UTC),
// so late-evening actions land on the right day. Weeks start on Monday.

export type IsoDate = string

/** Local calendar date, e.g. "2026-10-07" (toISOString would shift across midnight). */
export function toIsoDate(d: Date): IsoDate {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = (): IsoDate => toIsoDate(new Date())

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(iso)
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

export function mondayOf(iso: IsoDate): IsoDate {
  const d = parseIsoDate(iso)
  return addDays(iso, -((d.getDay() + 6) % 7))
}

export const isValidIsoDate = (value: string | null): value is IsoDate =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && toIsoDate(parseIsoDate(value)) === value

/** "Mon 5 Oct" */
export function dayLabel(iso: IsoDate): string {
  return parseIsoDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** "Wednesday 7 October" */
export function longDayLabel(iso: IsoDate): string {
  return parseIsoDate(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** "5 – 11 October", or "28 September – 4 October" across months. */
export function weekRangeLabel(monday: IsoDate): string {
  const start = parseIsoDate(monday)
  const end = parseIsoDate(addDays(monday, 6))
  const month = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' })
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${month(end)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`
}

/** "21 – 27 Sep", or "28 Sep – 4 Oct" across months. */
export function shortWeekRangeLabel(monday: IsoDate): string {
  const start = parseIsoDate(monday)
  const end = parseIsoDate(addDays(monday, 6))
  const month = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' })
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${month(end)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`
}

/** "YYYY-MM" month key, as used by GET /api/plan/days?month=. */
export type MonthKey = string

export const monthOf = (iso: IsoDate): MonthKey => iso.slice(0, 7)

export function addMonths(month: MonthKey, months: number): MonthKey {
  const [y, m] = month.split('-').map(Number)
  return monthOf(toIsoDate(new Date(y, m - 1 + months, 1)))
}

/** "September 2026" */
export function monthLabel(month: MonthKey): string {
  return parseIsoDate(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** Monday-first weeks covering the month, padded with the neighbouring months' days. */
export function monthGrid(month: MonthKey): IsoDate[][] {
  const weeks: IsoDate[][] = []
  for (let monday = mondayOf(`${month}-01`); monthOf(monday) <= month; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)))
  }
  return weeks
}

/** "This week", "Next week", "Last week", or "" for other weeks. */
export function relativeWeekLabel(monday: IsoDate, now: IsoDate = today()): string {
  const diff = Math.round((parseIsoDate(monday).getTime() - parseIsoDate(mondayOf(now)).getTime()) / (7 * 86_400_000))
  return diff === 0 ? 'This week' : diff === 1 ? 'Next week' : diff === -1 ? 'Last week' : ''
}
