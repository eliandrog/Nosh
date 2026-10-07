import { Link } from 'react-router'
import type { PlanDay, PlanEntry } from '../../api/types'
import { dayLabel } from '../../lib/dates'
import { mealName } from '../../lib/planEntry'
import { PlusIcon } from '../icons'
import { Chip } from '../ui'

type DayCardProps = {
  day: PlanDay
  isToday: boolean
  onOpenMeal: (entry: PlanEntry) => void
}

/** One day: its meals in order (any number) and "+ Add a meal". */
export function DayCard({ day, isToday, onOpenMeal }: DayCardProps) {
  const label = dayLabel(day.date)
  return (
    <section className={`day-card${isToday ? ' day-card--today' : ''}`} aria-label={isToday ? `${label}, today` : label}>
      <header className="day-card__header">
        <h2 className="day-card__title">{label}</h2>
        {isToday && <Chip variant="status">Today</Chip>}
      </header>
      {day.entries.length > 0 && (
        <ul className="day-card__meals">
          {day.entries.map((entry) => (
            <li key={entry.id}>
              <button type="button" className="meal-pill" onClick={() => onOpenMeal(entry)}>
                <span className="meal-pill__name">
                  {mealName(entry)}
                  {entry.recipeDeleted && <span className="meal-pill__deleted"> (deleted)</span>}
                </span>
                <span className="meal-pill__servings">for {entry.servings}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link to={`/week/add?date=${day.date}`} className="add-meal-btn" aria-label={`Add a meal on ${label}`}>
        <PlusIcon size={18} /> Add a meal
      </Link>
    </section>
  )
}
