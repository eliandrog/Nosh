import { forwardRef } from 'react'
import { Link } from 'react-router'
import type { Place, PlaceMeal } from '../../api/types'
import { dayLabel, mondayOf } from '../../lib/dates'
import type { IsoDate } from '../../lib/dates'
import { WEEKDAY_NAMES, directionsUrl, distanceLabel, mealTimes, placeTypeLabel, servesLabel } from '../../lib/places'
import { MealIcon, PlusIcon } from '../icons'
import { Button, Chip } from '../ui'

/** What happened when adding one meal: nothing yet, saving, added on a date, or a message. */
export type AddState = { status: 'idle' } | { status: 'saving' } | { status: 'added'; date: IsoDate } | { status: 'error'; message: string }

type PlaceCardProps = {
  place: Place
  selected: boolean
  /** Weekday (0 = Monday) of the user's today, to pick "today" vs "on Thursday". */
  todayWeekday: number
  addStates: Record<number, AddState>
  onSelect: () => void
  onAdd: (meal: PlaceMeal) => void
}

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')

/** One place: what it shares and when. Selected: add a meal to your week, or get directions. */
export const PlaceCard = forwardRef<HTMLElement, PlaceCardProps>(function PlaceCard(
  { place, selected, todayWeekday, addStates, onSelect, onAdd },
  ref,
) {
  const openToday = place.meals.some((m) => m.openToday)
  return (
    <article ref={ref} className={`place-card${selected ? ' place-card--selected' : ''}`} aria-current={selected || undefined}>
      <button type="button" className="place-card__select" onClick={onSelect} aria-expanded={selected}>
        <span className="place-card__name">{place.name}</span>
        {openToday && <Chip variant="status">Open today</Chip>}
      </button>
      <p className="place-card__meta">
        {placeTypeLabel(place.type)}
        {place.distanceKm !== null && ` · ${distanceLabel(place.distanceKm)}`}
      </p>

      {place.meals.map((meal) => {
        const state = addStates[meal.id] ?? { status: 'idle' }
        const isToday = meal.weekday === todayWeekday
        return (
          <div key={meal.id} className="place-meal">
            <p className="place-meal__name">
              <MealIcon size={18} aria-hidden="true" /> {meal.name}
            </p>
            {meal.dietary.length > 0 && (
              <p className="place-meal__chips">
                {meal.dietary.map((d) => (
                  <Chip key={d} variant="dietary">
                    {title(d)}
                  </Chip>
                ))}
              </p>
            )}
            <p className="place-meal__serves">{servesLabel(meal)}</p>
            <p className="place-meal__times">{mealTimes(meal)}</p>

            {selected && (
              <div className="place-meal__actions">
                {state.status === 'added' ? (
                  <p className="place-meal__added" role="status">
                    Added to {dayLabel(state.date)}. <Link to={`/week?week=${mondayOf(state.date)}`}>See your week</Link>
                  </p>
                ) : (
                  <Button block disabled={state.status === 'saving'} onClick={() => onAdd(meal)}>
                    <PlusIcon size={18} /> {isToday ? "Add to today's meals" : `Add on ${WEEKDAY_NAMES[meal.weekday]}`}
                  </Button>
                )}
                {state.status === 'error' && (
                  <p className="place-meal__error" role="alert">
                    {state.message}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {selected && (
        <a
          className="btn btn--outline btn--block place-card__directions"
          href={directionsUrl(place.latitude, place.longitude)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Directions
        </a>
      )}
    </article>
  )
})
