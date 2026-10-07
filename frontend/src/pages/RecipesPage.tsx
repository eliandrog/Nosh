import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { errorMessage } from '../api/client'
import { api } from '../api/endpoints'
import type { RecipePage, RecipeSummary } from '../api/types'
import { PageHeader } from '../components/Layout'
import { NoshMark } from '../components/NoshMark'
import { Pagination } from '../components/Pagination'
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
  | { status: 'ready'; data: RecipePage; query: string; page: number }

export const SEARCH_DELAY_MS = 300
export const PAGE_SIZE = 5

/** `?page=` from the URL; anything missing or invalid means page 1. */
function pageFrom(params: URLSearchParams): number {
  const n = Number(params.get('page'))
  return Number.isInteger(n) && n >= 1 ? n : 1
}

export function RecipesPage() {
  const [params, setParams] = useSearchParams()
  // The URL is the source of truth for what's loaded: /recipes?q=dahl&page=2.
  const urlQuery = params.get('q') ?? ''
  const page = pageFrom(params)

  const [text, setText] = useState(urlQuery)
  const debounced = useDebouncedValue(text.trim(), SEARCH_DELAY_MS)
  const query = text.trim() === '' ? '' : debounced // clearing is instant; typing waits for a pause
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const topRef = useRef<HTMLDivElement>(null)

  // A new search goes into the URL and starts again from page 1 (in one update, so only one request).
  useEffect(() => {
    setParams(
      (prev) => {
        if ((prev.get('q') ?? '') === query) return prev
        const next = new URLSearchParams(prev)
        if (query) next.set('q', query)
        else next.delete('q')
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }, [query, setParams])

  useEffect(() => {
    let cancelled = false // ignores replies to older requests that arrive late
    api
      .listRecipes({ q: urlQuery || undefined, page, pageSize: PAGE_SIZE })
      .then((data) => !cancelled && setState({ status: 'ready', data, query: urlQuery, page }))
      .catch((e) => !cancelled && setState({ status: 'error', message: errorMessage(e, 'Something went wrong loading recipes') }))
    return () => {
      cancelled = true
    }
  }, [urlQuery, page, attempt])

  // What's on screen belongs to an older search or page while the new one loads.
  const loadingNew = state.status === 'ready' && (state.query !== query || state.page !== page)

  const goToPage = (next: number) => {
    setParams((prev) => {
      const updated = new URLSearchParams(prev)
      if (next > 1) updated.set('page', String(next))
      else updated.delete('page')
      return updated
    }) // a history entry per page, so the phone's back button returns to the previous page
    topRef.current?.scrollIntoView?.({ block: 'start' })
  }

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }

  return (
    <div className="recipes" ref={topRef}>
      <PageHeader title="Recipes" logo={<NoshMark />} />
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
            {loadingNew ? 'Loading…' : resultText(state.data.total, state.query)}
          </p>
          {state.data.items.length > 0 ? (
            <ul className={`recipes__list${loadingNew ? ' recipes__list--stale' : ''}`}>
              {state.data.items.map((r) => (
                <li key={r.id}>
                  <RecipeCard recipe={r} />
                </li>
              ))}
            </ul>
          ) : state.data.total > 0 ? (
            <div className="recipes__note">
              <p>There are no recipes on this page.</p>
              <Button variant="outline" onClick={() => goToPage(1)}>
                Go to page 1
              </Button>
            </div>
          ) : (
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
          )}
          <Pagination label="Recipe pages" page={state.data.page} totalPages={state.data.totalPages} onChange={goToPage} />
        </>
      )}

      {/* Always reachable: sits above the tab bar while the list scrolls behind it. */}
      <div className="recipes__sticky-add">
        <Link to="/recipes/new" className="btn btn--primary btn--block">
          <PlusIcon size={20} /> Add your own recipe
        </Link>
      </div>
    </div>
  )
}

function resultText(total: number, query: string): string {
  const recipes = `${total} ${total === 1 ? 'recipe' : 'recipes'}`
  return query ? `${recipes} for “${query}”` : recipes
}
