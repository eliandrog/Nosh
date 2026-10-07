import { useEffect, useState } from 'react'
import { errorMessage } from '../../api/client'
import { api } from '../../api/endpoints'
import type { RecipeSummary } from '../../api/types'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { SearchBar } from '../SearchBar'

type Results = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; recipes: RecipeSummary[] }

type RecipePickerProps = {
  /** Recipe to leave out (the one being swapped). */
  excludeId?: string
  disabled?: boolean
  onPick: (recipe: RecipeSummary) => void
}

// Enough choices to scroll through; searching narrows it down.
const PICKER_PAGE_SIZE = 20

/** Search plus results (saved dietary preferences apply), each a 44px button that picks the recipe. */
export function RecipePicker({ excludeId, disabled = false, onPick }: RecipePickerProps) {
  const [text, setText] = useState('')
  const debounced = useDebouncedValue(text.trim(), 300)
  const query = text.trim() === '' ? '' : debounced
  const [results, setResults] = useState<Results>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false // ignores replies to older searches
    api
      .listRecipes({ q: query || undefined, pageSize: PICKER_PAGE_SIZE })
      .then((page) => !cancelled && setResults({ status: 'ready', recipes: page.items }))
      .catch((e) => !cancelled && setResults({ status: 'error', message: errorMessage(e, "Couldn't load recipes") }))
    return () => {
      cancelled = true
    }
  }, [query])

  const recipes = results.status === 'ready' ? results.recipes.filter((r) => r.id !== excludeId) : []
  return (
    <div className="recipe-picker">
      <SearchBar value={text} onChange={setText} label="Search recipes" placeholder="Search recipes or ingredients" />
      {results.status === 'loading' && <p className="week__note">Loading recipes…</p>}
      {results.status === 'error' && (
        <p className="week__note" role="alert">
          {results.message}
        </p>
      )}
      {results.status === 'ready' && recipes.length === 0 && (
        <p className="week__note">{query ? `No recipes match “${query}”.` : 'No other recipes suit your preferences yet.'}</p>
      )}
      {recipes.length > 0 && (
        <ul className="recipe-picker__list">
          {recipes.map((r) => (
            <li key={r.id}>
              <button type="button" className="recipe-picker__item" disabled={disabled} onClick={() => onPick(r)}>
                <span className="meal-result__thumb" aria-hidden="true">
                  {r.defaultImage}
                </span>
                <span className="meal-result__text">
                  <span className="meal-result__name">{r.name}</span>
                  <span className="meal-result__meta">Serves {r.serves}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
