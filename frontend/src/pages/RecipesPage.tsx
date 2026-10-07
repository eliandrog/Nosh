import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { errorMessage } from '../api/client'
import { api } from '../api/endpoints'
import type { RecipeSummary } from '../api/types'
import { PageHeader } from '../components/Layout'
import { SearchBar } from '../components/SearchBar'
import { Button, Chip } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import './RecipesPage.css'

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  // Up to two chips: dietary labels first (Leaf), then tags (green).
  const chips = [
    ...recipe.dietary.map((d) => ({ key: d, label: title(d), variant: 'dietary' as const })),
    ...recipe.tags.map((t) => ({ key: t.key, label: t.name, variant: 'tag' as const })),
  ].slice(0, 2)
  return (
    <Link to={`/recipes/${recipe.slug}`} className="recipe-card">
      <span className="recipe-card__thumb" aria-hidden="true">
        {recipe.imageUrl ? <img src={recipe.imageUrl} alt="" /> : recipe.defaultImage}
      </span>
      <span className="recipe-card__info">
        <span className="recipe-card__title">{recipe.name}</span>
        <span className="recipe-card__meta">
          {title(recipe.cuisine)} · Serves {recipe.serves}
        </span>
        {chips.length > 0 && (
          <span className="recipe-card__chips">
            {chips.map((c) => (
              <Chip key={c.key} variant={c.variant}>
                {c.label}
              </Chip>
            ))}
          </span>
        )}
      </span>
    </Link>
  )
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; recipes: RecipeSummary[]; query: string }

export const SEARCH_DELAY_MS = 300

export function RecipesPage() {
  const [params, setParams] = useSearchParams()
  const [text, setText] = useState(() => params.get('q') ?? '')
  const debounced = useDebouncedValue(text.trim(), SEARCH_DELAY_MS)
  const query = text.trim() === '' ? '' : debounced // clearing is instant; typing waits for a pause
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // Keep the search in the URL (/recipes?q=dahl) so back, refresh and shared links keep it.
  useEffect(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (query) next.set('q', query)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }, [query, setParams])

  useEffect(() => {
    let cancelled = false // ignores replies to older searches that arrive late
    api
      .listRecipes({ q: query || undefined })
      .then((recipes) => !cancelled && setState({ status: 'ready', recipes, query }))
      .catch((e) => !cancelled && setState({ status: 'error', message: errorMessage(e, 'Something went wrong loading recipes') }))
    return () => {
      cancelled = true
    }
  }, [query, attempt])

  // Results on screen are for an older query while the new search is in flight.
  const searching = state.status === 'ready' && state.query !== query

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }

  return (
    <>
      <PageHeader title="Recipes" />
      <div className="recipes__search">
        <SearchBar value={text} onChange={setText} label="Search recipes" placeholder="Search recipes or ingredients" />
      </div>

      {state.status === 'loading' && <p className="recipes__note">Loading recipes…</p>}

      {state.status === 'error' && (
        <div className="recipes__note" role="alert">
          <p>{state.message}</p>
          <Button variant="outline" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <p className="recipes__count" aria-live="polite">
            {searching ? 'Searching…' : resultText(state.recipes.length, state.query)}
          </p>
          {state.recipes.length === 0 ? (
            <div className="recipes__note">
              {state.query ? (
                <>
                  <p>No recipes match “{state.query}”. Try another word or an ingredient.</p>
                  <Button variant="outline" onClick={() => setText('')}>
                    Show all recipes
                  </Button>
                </>
              ) : (
                <p>No recipes match your preferences yet.</p>
              )}
            </div>
          ) : (
            <ul className={`recipes__list${searching ? ' recipes__list--stale' : ''}`}>
              {state.recipes.map((r) => (
                <li key={r.id}>
                  <RecipeCard recipe={r} />
                </li>
              ))}
            </ul>
          )}
          <Link to="/recipes/new" className="btn btn--primary btn--block recipes__add">
            <PlusIcon size={20} /> Add your own recipe
          </Link>
        </>
      )}
    </>
  )
}

function resultText(count: number, query: string): string {
  const recipes = `${count} ${count === 1 ? 'recipe' : 'recipes'}`
  return query ? `${recipes} for “${query}”` : recipes
}
