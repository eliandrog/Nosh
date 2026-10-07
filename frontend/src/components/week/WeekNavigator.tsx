import { addDays, relativeWeekLabel, weekRangeLabel } from '../../lib/dates'
import type { IsoDate } from '../../lib/dates'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons'

type WeekNavigatorProps = {
  monday: IsoDate
  onChange: (monday: IsoDate) => void
}

/** ‹ 5 – 11 October › with "This week" / "Next week" / "Last week" underneath. */
export function WeekNavigator({ monday, onChange }: WeekNavigatorProps) {
  const relative = relativeWeekLabel(monday)
  return (
    <nav className="week-nav" aria-label="Choose week">
      <button type="button" className="week-nav__arrow" aria-label="Previous week" onClick={() => onChange(addDays(monday, -7))}>
        <ChevronLeftIcon size={22} />
      </button>
      <div className="week-nav__range" aria-live="polite">
        <span className="week-nav__dates">
          <CalendarIcon size={18} aria-hidden="true" />
          {weekRangeLabel(monday)}
        </span>
        {relative && <span className="week-nav__relative">{relative}</span>}
      </div>
      <button type="button" className="week-nav__arrow" aria-label="Next week" onClick={() => onChange(addDays(monday, 7))}>
        <ChevronRightIcon size={22} />
      </button>
    </nav>
  )
}
