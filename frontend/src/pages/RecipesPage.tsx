import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { NetworkError } from '../api/client'
import { api } from '../api/endpoints'
import type { MealType, RecipeSummary } from '../api/types'
import { PageHeader } from '../components/Layout'
import { Button, Chip } from '../components/ui'
import { PlusIcon } from '../components/icons'
import './RecipesPage.css'

// ASSUMPTION (5): default image = emoji per first meal type until photos/icons exist.
const MEAL_EMOJI: Record<MealType, string> = { breakfast: '🥣', lunch: '🥪', dinner: '🍲', dessert: '🍰' }

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  // Up to two chips: dietary labels first (Leaf), then tags (green).
  const chips = [
    ...recipe.dietary.map((d) => ({ key: d, label: title(d), variant: 'dietary' as const })),
    ...recipe.tags.map((t) => ({ key: t, label: title(t), variant: 'tag' as const })),
  ].slice(0, 2)
  return (
    <Link to={`/recipes/${recipe.id}`} className="recipe-card">
      <span className="recipe-card__thumb" aria-hidden="true">
        {recipe.mealType[0] ? MEAL_EMOJI[recipe.mealType[0]] : '🍽️'}
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

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; recipes: RecipeSummary[] }

export function RecipesPage() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .listRecipes()
      .then((recipes) => !cancelled && setState({ status: 'ready', recipes }))
      .catch((e) => !cancelled && setState({ status: 'error', message: e instanceof NetworkError ? e.message : 'Something went wrong loading recipes' }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  return (
    <>
      <PageHeader title="Recipes" />
      {state.status === 'loading' && <p className="recipes__note">Loading recipes…</p>}
      {state.status === 'error' && (
        <div className="recipes__note" role="alert">
          <p>{state.message}.</p>
          <Button variant="outline" onClick={() => { setState({ status: 'loading' }); setAttempt((a) => a + 1) }}>
            Try again
          </Button>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          {state.recipes.length === 0 ? (
            <p className="recipes__note">No recipes match your preferences yet.</p>
          ) : (
            <ul className="recipes__list">
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
