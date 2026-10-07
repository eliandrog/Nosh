import { useState } from 'react'
import { addDays, relativeWeekLabel, weekRangeLabel } from '../../lib/dates'
import type { IsoDate } from '../../lib/dates'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons'
import { CalendarSheet } from './CalendarSheet'

type WeekNavigatorProps = {
  monday: IsoDate
  onChange: (monday: IsoDate) => void
}

/** ‹ 5 – 11 October › with "This week" / "Next week" / "Last week" underneath. Tap the dates for a calendar. */
export function WeekNavigator({ monday, onChange }: WeekNavigatorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const relative = relativeWeekLabel(monday)
  const range = weekRangeLabel(monday)
  return (
    <nav className="week-nav" aria-label="Choose week">
      <button type="button" className="week-nav__arrow" aria-label="Previous week" onClick={() => onChange(addDays(monday, -7))}>
        <ChevronLeftIcon size={22} />
      </button>
      <button
        type="button"
        className="week-nav__range"
        aria-label={`Choose a week, ${range}`}
        aria-haspopup="dialog"
        onClick={() => setCalendarOpen(true)}
      >
        <span className="week-nav__dates">
          <CalendarIcon size={18} aria-hidden="true" />
          {range}
        </span>
        {relative && <span className="week-nav__relative">{relative}</span>}
      </button>
      <button type="button" className="week-nav__arrow" aria-label="Next week" onClick={() => onChange(addDays(monday, 7))}>
        <ChevronRightIcon size={22} />
      </button>
      {calendarOpen && (
        <CalendarSheet
          open
          monday={monday}
          onClose={() => setCalendarOpen(false)}
          onPick={(picked) => {
            setCalendarOpen(false)
            onChange(picked)
          }}
        />
      )}
    </nav>
  )
}
