import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../../api/client'
import { api } from '../../api/endpoints'
import type { RecipeDetail } from '../../api/types'
import { amountLabel } from '../../lib/amounts'
import { addDays, dayLabel, mondayOf, parseIsoDate, today } from '../../lib/dates'
import type { IsoDate } from '../../lib/dates'
import { BottomSheet, Button, Stepper } from '../ui'

const PREVIEW_LINES = 4

type Props = {
  recipe: RecipeDetail
  open: boolean
  onClose: () => void
}

type Preview = { status: 'loading' } | { status: 'error' } | { status: 'ready'; recipe: RecipeDetail }

/** Pick a day this week and how many people it's for, see what you'll need, then add it to the plan. */
export function AddToWeekSheet({ recipe, open, onClose }: Props) {
  const now = today()
  const days = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(now), i))
  const [date, setDate] = useState<IsoDate>(now)
  const [servings, setServings] = useState(recipe.serves)
  const [preview, setPreview] = useState<Preview>({ status: 'loading' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [added, setAdded] = useState<IsoDate | null>(null)

  // Default servings: the household size from Settings, else the recipe's own serves.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    api
      .getProfile()
      .then((p) => !cancelled && p.householdSize && setServings(p.householdSize))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open])

  // Amounts scaled by the API for the chosen servings; replies to older choices are ignored.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    api
      .getRecipe(recipe.slug, servings)
      .then((scaled) => !cancelled && setPreview({ status: 'ready', recipe: scaled }))
      .catch(() => !cancelled && setPreview({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [open, recipe.slug, servings])

  const add = async () => {
    setSaving(true)
    setError(undefined)
    try {
      await api.addPlanEntry({ date, recipeId: recipe.id, servings })
      setAdded(date)
    } catch (e) {
      setError(errorMessage(e, "Couldn't add it to your week. Please try again."))
    } finally {
      setSaving(false)
    }
  }

  const lines = preview.status === 'ready' ? preview.recipe.ingredients : []
  const more = lines.length - PREVIEW_LINES

  return (
    <BottomSheet open={open} title={added ? 'Added to your week' : `Add ${recipe.name} to your week`} onClose={onClose}>
      {added ? (
        <div className="add-week__done" role="status">
          <p>
            {recipe.name} is on {dayLabel(added)} for {servings} {servings === 1 ? 'person' : 'people'}.
          </p>
          <Link to={`/week?week=${added}`} className="btn btn--primary btn--block">
            See your week
          </Link>
          <Button variant="outline" block onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <>
          <fieldset className="add-week__group">
            <legend className="add-week__label">Day</legend>
            <div className="day-picker">
              {days.map((d) => {
                const date_ = parseIsoDate(d)
                return (
                  <button
                    key={d}
                    type="button"
                    className={`day-picker__day${d === date ? ' day-picker__day--selected' : ''}`}
                    aria-pressed={d === date}
                    aria-label={dayLabel(d)}
                    onClick={() => setDate(d)}
                  >
                    <span className="day-picker__weekday">{date_.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                    <span className="day-picker__date">{date_.getDate()}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="add-week__group">
            <span className="add-week__label">Servings</span>
            <div className="add-week__servings">
              <Stepper label="Servings" value={servings} min={1} max={20} onChange={setServings} />
              <span className="add-week__hint">Recipe serves {recipe.serves}</span>
            </div>
          </div>

          <div className="add-week__preview" aria-live="polite">
            <p className="add-week__preview-title">You’ll need</p>
            {preview.status === 'loading' && <p className="add-week__hint">Working out amounts…</p>}
            {preview.status === 'error' && <p className="add-week__hint">Couldn’t work out the amounts.</p>}
            {preview.status === 'ready' && (
              <ul className="ingredient-list">
                {lines.slice(0, PREVIEW_LINES).map((line, i) => (
                  <li key={`${line.ingredientId}-${i}`} className="ingredient-line">
                    <span className="ingredient-line__amount">{amountLabel(line.quantity, line.unit)}</span>
                    <span>{line.item}</span>
                  </li>
                ))}
              </ul>
            )}
            {more > 0 && (
              <p className="add-week__more">
                + {more} more {more === 1 ? 'ingredient' : 'ingredients'}
              </p>
            )}
          </div>

          {error && (
            <p className="add-week__error" role="alert">
              {error}
            </p>
          )}
          <Button block onClick={add} disabled={saving}>
            {saving ? 'Adding…' : `Add to ${dayLabel(date)}`}
          </Button>
        </>
      )}
    </BottomSheet>
  )
}
