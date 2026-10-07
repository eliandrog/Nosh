import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { errorMessage } from '../api/client'
import { api } from '../api/endpoints'
import type { RecipeSummary } from '../api/types'
import { ChevronRightIcon, CloseIcon, PlusIcon } from '../components/icons'
import { SearchBar } from '../components/SearchBar'
import { BottomSheet, Button, Stepper } from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { dayLabel, isValidIsoDate, longDayLabel, today } from '../lib/dates'
import '../components/week/Week.css'

type Results = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; recipes: RecipeSummary[] }

/** "+ Add a meal" on a day: search or pick a suggestion, choose servings, add. Or create a new recipe. */
export function AddMealPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const requested = params.get('date')
  const date = isValidIsoDate(requested) ? requested : today()
  const backTo = `/week?week=${date}`

  const [text, setText] = useState('')
  const debounced = useDebouncedValue(text.trim(), 300)
  const query = text.trim() === '' ? '' : debounced
  const [results, setResults] = useState<Results>({ status: 'loading' })
  const [householdSize, setHouseholdSize] = useState<number | null>(null)
  const [picked, setPicked] = useState<RecipeSummary | null>(null)
  const [servings, setServings] = useState(2)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    api
      .listRecipes({ q: query || undefined })
      .then((page) => !cancelled && setResults({ status: 'ready', recipes: page.items }))
      .catch((e) => !cancelled && setResults({ status: 'error', message: errorMessage(e, "Couldn't load recipes") }))
    return () => {
      cancelled = true
    }
  }, [query])

  useEffect(() => {
    api
      .getProfile()
      .then((p) => setHouseholdSize(p.householdSize))
      .catch(() => undefined) // optional: falls back to the recipe's own servings
  }, [])

  const pick = (recipe: RecipeSummary) => {
    setPicked(recipe)
    setServings(householdSize ?? recipe.serves)
    setSaveError(undefined)
  }

  const add = async () => {
    if (!picked) return
    setSaving(true)
    try {
      await api.addPlanEntry({ date, recipeId: picked.id, servings })
      navigate(backTo)
    } catch (e) {
      setSaveError(errorMessage(e, "Couldn't add the meal. Please try again."))
      setSaving(false)
    }
  }

  return (
    <>
      <header className="add-meal__header">
        <div>
          <h1 className="add-meal__title">Add a meal</h1>
          <p className="add-meal__date">{longDayLabel(date)}</p>
        </div>
        <Link to={backTo} className="icon-btn icon-btn--surface" aria-label="Close">
          <CloseIcon size={22} />
        </Link>
      </header>

      <SearchBar value={text} onChange={setText} label="Search recipes" placeholder="Search recipes or ingredients" />

      <Link to="/recipes/new" className="create-recipe-card">
        <span className="create-recipe-card__icon" aria-hidden="true">
          <PlusIcon size={22} />
        </span>
        <span className="create-recipe-card__text">
          <span className="create-recipe-card__title">Create a new recipe</span>
          <span className="create-recipe-card__hint">Add your own, then plan it</span>
        </span>
        <ChevronRightIcon size={20} aria-hidden="true" />
      </Link>

      <h2 className="add-meal__section">{query ? `Results for “${query}”` : 'Suggestions for you'}</h2>
      {results.status === 'loading' && <p className="week__note">Loading recipes…</p>}
      {results.status === 'error' && (
        <p className="week__note" role="alert">
          {results.message}
        </p>
      )}
      {results.status === 'ready' &&
        (results.recipes.length === 0 ? (
          <p className="week__note">No recipes match “{query}”. Try another word, or create a new recipe.</p>
        ) : (
          <ul className="meal-results">
            {results.recipes.map((r) => (
              <li key={r.id} className="meal-result">
                <span className="meal-result__thumb" aria-hidden="true">
                  {r.defaultImage}
                </span>
                <span className="meal-result__text">
                  <span className="meal-result__name">{r.name}</span>
                  <span className="meal-result__meta">Serves {r.serves}</span>
                </span>
                <button type="button" className="icon-btn icon-btn--green" aria-label={`Add ${r.name}`} onClick={() => pick(r)}>
                  <PlusIcon size={22} />
                </button>
              </li>
            ))}
          </ul>
        ))}

      <BottomSheet open={picked !== null} title={picked ? `Add ${picked.name}` : ''} onClose={() => setPicked(null)}>
        {picked && (
          <>
            <div className="meal-sheet__row">
              <span className="form-label">Servings</span>
              <Stepper label="Servings" value={servings} min={1} max={20} onChange={setServings} />
            </div>
            <p className="meal-sheet__day">Recipe serves {picked.serves}</p>
            {saveError && (
              <p className="week__error" role="alert">
                {saveError}
              </p>
            )}
            <Button block disabled={saving} onClick={add}>
              {saving ? 'Adding…' : `Add to ${dayLabel(date)}`}
            </Button>
          </>
        )}
      </BottomSheet>
    </>
  )
}
