import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, errorMessage } from '../api/client'
import { api } from '../api/endpoints'
import type { RecipeDetail } from '../api/types'
import { RecipeEditor } from '../components/recipe-form/RecipeEditor'
import { fromRecipe } from '../components/recipe-form/recipeForm'
import '../components/recipe-detail/RecipeDetail.css'

type State =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; recipe: RecipeDetail }

/** Edit your own recipe with the same form as "Add your own recipe". Renaming changes the URL. */
export function EditRecipePage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'loading' })

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
  }, [slug])

  if (state.status === 'loading') return <p className="recipe-page__note">Loading recipe…</p>
  if (state.status !== 'ready' || !state.recipe.isCustom) {
    const message =
      state.status === 'ready'
        ? 'Built-in Nosh recipes can’t be edited or deleted.'
        : state.status === 'not-found'
          ? 'We couldn’t find that recipe.'
          : state.message
    return (
      <div className="recipe-page__note" role={state.status === 'error' ? 'alert' : undefined}>
        <p>{message}</p>
        <Link to={state.status === 'ready' ? `/recipes/${slug}` : '/recipes'} className="btn btn--outline">
          Go back
        </Link>
      </div>
    )
  }

  return (
    <RecipeEditor
      title="Edit recipe"
      initial={fromRecipe(state.recipe)}
      cancelTo={`/recipes/${slug}`}
      submitLabel="Save changes"
      onSave={async (payload) => {
        const saved = await api.updateRecipe(slug, payload)
        navigate(`/recipes/${saved.slug}`, { replace: true })
      }}
    />
  )
}
