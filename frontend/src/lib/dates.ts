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

/** "This week", "Next week", "Last week", or "" for other weeks. */
export function relativeWeekLabel(monday: IsoDate, now: IsoDate = today()): string {
  const diff = Math.round((parseIsoDate(monday).getTime() - parseIsoDate(mondayOf(now)).getTime()) / (7 * 86_400_000))
  return diff === 0 ? 'This week' : diff === 1 ? 'Next week' : diff === -1 ? 'Last week' : ''
}
