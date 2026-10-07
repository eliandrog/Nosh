import { useId, useState } from 'react'
import { Link } from 'react-router'
import type { PlanEntry } from '../../api/types'
import { dayLabel, longDayLabel } from '../../lib/dates'
import type { IsoDate } from '../../lib/dates'
import { mealName } from '../../lib/planEntry'
import { TrashIcon } from '../icons'
import { BottomSheet, Button, Stepper } from '../ui'
import { RecipePicker } from './RecipePicker'

/** "Wednesday" from a date, for free meals that only run on one weekday. */
const parseWeekday = (iso: IsoDate): string => longDayLabel(iso).split(' ')[0]

type MealOptionsSheetProps = {
  entry: PlanEntry | null
  weekDays: IsoDate[]
  busy: boolean
  onClose: () => void
  onServings: (servings: number) => void
  onMove: (date: IsoDate) => void
  onSwap: (recipeId: string) => void
  onRemove: () => void
}

/** Tap a planned meal: change servings, view the recipe, swap it, move it to another day, or remove it. */
export function MealOptionsSheet({ entry, weekDays, busy, onClose, onServings, onMove, onSwap, onRemove }: MealOptionsSheetProps) {
  const moveId = useId()
  const [moveTo, setMoveTo] = useState<IsoDate>('')
  const [swapping, setSwapping] = useState(false)
  if (!entry) return null

  if (swapping) {
    return (
      <BottomSheet open title={`Swap ${mealName(entry)}`} onClose={onClose}>
        <p className="meal-sheet__day">
          {longDayLabel(entry.date)} · keeps {entry.servings} {entry.servings === 1 ? 'serving' : 'servings'}
        </p>
        <button type="button" className="meal-sheet__swap-back" onClick={() => setSwapping(false)}>
          ‹ Back to meal options
        </button>
        <RecipePicker excludeId={entry.recipeId ?? undefined} disabled={busy} onPick={(r) => onSwap(r.id)} />
      </BottomSheet>
    )
  }

  // A free meal is only served on its weekday, so it can't move to another day of the same week.
  const isFreeMeal = entry.kind === 'free_meal'
  const otherDays = isFreeMeal ? [] : weekDays.filter((d) => d !== entry.date)
  const servedOn = parseWeekday(entry.date)
  return (
    <BottomSheet open title={mealName(entry)} onClose={onClose}>
      <p className="meal-sheet__day">{longDayLabel(entry.date)}</p>

      <div className="meal-sheet__row">
        <span className="form-label">Servings</span>
        <Stepper label="Servings" value={entry.servings} min={1} max={20} onChange={(n) => !busy && onServings(n)} />
      </div>

      {entry.recipeSlug && !entry.recipeDeleted && (
        <Link to={`/recipes/${entry.recipeSlug}`} className="btn btn--outline btn--block">
          View recipe
        </Link>
      )}

      <Button variant="outline" block disabled={busy} onClick={() => setSwapping(true)}>
        Swap for another recipe
      </Button>

      {isFreeMeal ? (
        <p className="meal-sheet__note">Only served on {servedOn}s, so it stays on this day.</p>
      ) : (
        <div className="meal-sheet__move">
          <label htmlFor={moveId} className="form-label">
            Move to another day
          </label>
          <div className="meal-sheet__move-row">
            <select id={moveId} className="text-input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Choose a day</option>
              {otherDays.map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d)}
                </option>
              ))}
            </select>
            <Button variant="outline" disabled={!moveTo || busy} onClick={() => onMove(moveTo)}>
              Move
            </Button>
          </div>
        </div>
      )}

      <button type="button" className="meal-sheet__remove" disabled={busy} onClick={onRemove}>
        <TrashIcon size={20} className="meal-sheet__remove-icon" aria-hidden="true" />
        Remove from plan
      </button>
    </BottomSheet>
  )
}
