import { useId, useState } from 'react'
import { Link } from 'react-router'
import type { PlanEntry } from '../../api/types'
import { dayLabel, longDayLabel } from '../../lib/dates'
import type { IsoDate } from '../../lib/dates'
import { TrashIcon } from '../icons'
import { BottomSheet, Button, Stepper } from '../ui'

type MealOptionsSheetProps = {
  entry: PlanEntry | null
  weekDays: IsoDate[]
  busy: boolean
  onClose: () => void
  onServings: (servings: number) => void
  onMove: (date: IsoDate) => void
  onRemove: () => void
}

/** Tap a planned meal: change servings, view the recipe, move it to another day, or remove it. */
export function MealOptionsSheet({ entry, weekDays, busy, onClose, onServings, onMove, onRemove }: MealOptionsSheetProps) {
  const moveId = useId()
  const [moveTo, setMoveTo] = useState<IsoDate>('')
  if (!entry) return null

  const otherDays = weekDays.filter((d) => d !== entry.date)
  return (
    <BottomSheet open title={entry.recipeName} onClose={onClose}>
      <p className="meal-sheet__day">{longDayLabel(entry.date)}</p>

      <div className="meal-sheet__row">
        <span className="form-label">Servings</span>
        <Stepper label="Servings" value={entry.servings} min={1} max={20} onChange={(n) => !busy && onServings(n)} />
      </div>

      {!entry.recipeDeleted && (
        <Link to={`/recipes/${entry.recipeSlug}`} className="btn btn--outline btn--block">
          View recipe
        </Link>
      )}

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

      <button type="button" className="meal-sheet__remove" disabled={busy} onClick={onRemove}>
        <TrashIcon size={20} className="meal-sheet__remove-icon" aria-hidden="true" />
        Remove from plan
      </button>
    </BottomSheet>
  )
}
