import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, errorMessage } from '../api/client'
import { api } from '../api/endpoints'
import type { RecipeDetail } from '../api/types'
import { AddToWeekSheet } from '../components/recipe-detail/AddToWeekSheet'
import { DeleteRecipeSheet } from '../components/recipe-detail/DeleteRecipeSheet'
import { IngredientList, MethodList, RecipeLabels } from '../components/recipe-detail/RecipeBody'
import { RecipeHeader } from '../components/recipe-detail/RecipeHeader'
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons'
import { Button } from '../components/ui'
import '../components/recipe-detail/RecipeDetail.css'

type State =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; recipe: RecipeDetail }

type Sheet = 'week' | 'delete' | null

export function RecipeDetailPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [sheet, setSheet] = useState<Sheet>(null)

  useEffect(() => {
    let cancelled = false
    api
      .getRecipe(slug)
      .then((recipe) => !cancelled && setState({ status: 'ready', recipe }))
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 404) setState({ status: 'not-found' })
        else setState({ status: 'error', message: errorMessage(e, "Couldn't load this recipe") })
      })
    return () => {
      cancelled = true
    }
  }, [slug, attempt])

  if (state.status === 'loading') return <p className="recipe-page__note">Loading recipe…</p>
  if (state.status === 'not-found') {
    return (
      <div className="recipe-page__note">
        <h1 className="recipe-page__missing">We couldn’t find that recipe</h1>
        <p>It may have been deleted or renamed.</p>
        <Link to="/recipes" className="btn btn--primary btn--block">
          Back to recipes
        </Link>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="recipe-page__note" role="alert">
        <p>{state.message}</p>
        <Button variant="outline" onClick={() => { setState({ status: 'loading' }); setAttempt((a) => a + 1) }}>
          Try again
        </Button>
      </div>
    )
  }

  const { recipe } = state
  return (
    <article className="recipe-page">
      <RecipeHeader recipe={recipe} />
      <div className="recipe-page__body">
        <RecipeLabels recipe={recipe} />
        <Button block onClick={() => setSheet('week')}>
          <PlusIcon size={20} /> Add to my week
        </Button>
        {recipe.isCustom ? (
          <div className="recipe-page__actions">
            <Link to={`/recipes/${recipe.slug}/edit`} className="btn btn--outline">
              <EditIcon size={20} aria-hidden="true" /> Edit
            </Link>
            <Button variant="outline" onClick={() => setSheet('delete')}>
              <TrashIcon size={20} className="delete-recipe__icon" aria-hidden="true" /> Delete
            </Button>
          </div>
        ) : (
          <p className="recipe-page__builtin">Built-in Nosh recipes can’t be edited or deleted.</p>
        )}
        <IngredientList recipe={recipe} />
        <MethodList recipe={recipe} />
      </div>

      {sheet === 'week' && <AddToWeekSheet recipe={recipe} open onClose={() => setSheet(null)} />}
      {sheet === 'delete' && (
        <DeleteRecipeSheet recipe={recipe} open onClose={() => setSheet(null)} onDeleted={() => navigate('/recipes')} />
      )}
    </article>
  )
}
