import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { api } from '../../api/endpoints'
import {
  addDays,
  addMonths,
  dayLabel,
  mondayOf,
  monthGrid,
  monthLabel,
  monthOf,
  parseIsoDate,
  shortWeekRangeLabel,
  today,
} from '../../lib/dates'
import type { IsoDate, MonthKey } from '../../lib/dates'
import { ChevronLeftIcon, ChevronRightIcon } from '../icons'
import { BottomSheet, Button } from '../ui'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const ARROW_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

type CalendarSheetProps = {
  open: boolean
  /** Monday of the week currently shown. */
  monday: IsoDate
  onClose: () => void
  onPick: (monday: IsoDate) => void
}

/** "Jump to a date": a month view for going far back or forward without paging week by week. */
export function CalendarSheet({ open, monday, onClose, onPick }: CalendarSheetProps) {
  const now = today()
  const initial = mondayOf(now) === monday ? now : monday
  const [selected, setSelected] = useState<IsoDate>(initial)
  const [month, setMonth] = useState<MonthKey>(monthOf(initial))
  const [planned, setPlanned] = useState<ReadonlySet<IsoDate>>(new Set())
  const gridRef = useRef<HTMLDivElement>(null)
  const focusSelected = useRef(false)

  // Dots for days that have meals; replies for a month we've already left are ignored.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    api
      .getPlannedDays(month)
      .then((days) => !cancelled && setPlanned(new Set(days.dates)))
      .catch(() => !cancelled && setPlanned(new Set()))
    return () => {
      cancelled = true
    }
  }, [open, month])

  // After keyboard navigation, keep focus on the newly selected day (it may be in another month).
  useEffect(() => {
    if (!focusSelected.current) return
    focusSelected.current = false
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus()
  }, [selected, month])

  const select = (date: IsoDate) => {
    setSelected(date)
    setMonth(monthOf(date))
  }

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = ARROW_STEPS[e.key]
    if (!step) return
    e.preventDefault()
    focusSelected.current = true
    select(addDays(selected, step))
  }

  const selectedWeek = mondayOf(selected)
  return (
    <BottomSheet open={open} title="Jump to a date" onClose={onClose}>
      <div className="calendar__toolbar">
        <button type="button" className="week-nav__arrow" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeftIcon size={22} />
        </button>
        <span className="calendar__month" aria-live="polite">
          {monthLabel(month)}
        </span>
        <button type="button" className="week-nav__arrow" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRightIcon size={22} />
        </button>
        <button type="button" className="calendar__today" onClick={() => onPick(mondayOf(now))}>
          Today
        </button>
      </div>

      <div className="calendar" role="grid" aria-label={monthLabel(month)} ref={gridRef} onKeyDown={onGridKey}>
        <div className="calendar__row" role="row">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="calendar__weekday" role="columnheader" aria-hidden="true">
              {d}
            </span>
          ))}
        </div>
        {monthGrid(month).map((week) => (
          <div key={week[0]} role="row" className={`calendar__row${week[0] === selectedWeek ? ' calendar__row--selected' : ''}`}>
            {week.map((date) => {
              const isSelected = date === selected
              const hasMeals = planned.has(date)
              const outside = monthOf(date) !== month
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  data-date={date}
                  tabIndex={isSelected ? 0 : -1}
                  aria-selected={isSelected}
                  aria-label={`${dayLabel(date)}${date === now ? ', today' : ''}${hasMeals ? ', meals planned' : ''}`}
                  className={['calendar__day', isSelected && 'calendar__day--selected', outside && 'calendar__day--outside', date === now && 'calendar__day--today']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => select(date)}
                >
                  {parseIsoDate(date).getDate()}
                  <span className={`calendar__dot${hasMeals ? ' calendar__dot--on' : ''}`} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <p className="calendar__legend">
        <span className="calendar__dot calendar__dot--on" aria-hidden="true" /> Meals planned
      </p>
      <Button block onClick={() => onPick(selectedWeek)}>
        Show week of {shortWeekRangeLabel(selectedWeek)}
      </Button>
    </BottomSheet>
  )
}
