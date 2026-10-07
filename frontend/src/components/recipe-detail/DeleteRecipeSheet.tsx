import { useEffect, useState } from 'react'
import { errorMessage } from '../../api/client'
import { api } from '../../api/endpoints'
import type { RecipeDetail } from '../../api/types'
import { today } from '../../lib/dates'
import { TrashIcon } from '../icons'
import { BottomSheet, Button } from '../ui'

type Props = {
  recipe: RecipeDetail
  open: boolean
  onClose: () => void
  onDeleted: () => void
}

type Usage = { status: 'loading' } | { status: 'ready'; upcoming: number } | { status: 'unknown' }

/** Confirms deleting your own recipe and says how many upcoming meals it will remove. */
export function DeleteRecipeSheet({ recipe, open, onClose, onDeleted }: Props) {
  const [usage, setUsage] = useState<Usage>({ status: 'loading' })
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    api
      .getRecipeUsage(recipe.slug, today())
      .then((u) => !cancelled && setUsage({ status: 'ready', upcoming: u.upcomingMeals }))
      .catch(() => !cancelled && setUsage({ status: 'unknown' }))
    return () => {
      cancelled = true
    }
  }, [open, recipe.slug])

  const remove = async () => {
    setDeleting(true)
    setError(undefined)
    try {
      await api.deleteRecipe(recipe.slug, today())
      onDeleted()
    } catch (e) {
      setError(errorMessage(e, "Couldn't delete the recipe. Please try again."))
      setDeleting(false)
    }
  }

  return (
    <BottomSheet open={open} title={`Delete ${recipe.name}?`} onClose={onClose}>
      <p className="delete-recipe__text">
        {usage.status === 'loading' && 'Checking your plan…'}
        {usage.status === 'ready' &&
          (usage.upcoming > 0
            ? `This removes ${usage.upcoming} upcoming ${usage.upcoming === 1 ? 'meal' : 'meals'} from your plan. Past weeks keep it.`
            : 'It isn’t planned for any upcoming days. Past weeks keep it.')}
        {usage.status === 'unknown' && 'Upcoming meals using it will be removed. Past weeks keep it.'}
      </p>
      {error && (
        <p className="add-week__error" role="alert">
          {error}
        </p>
      )}
      <div className="delete-recipe__actions">
        <Button variant="outline" block onClick={remove} disabled={deleting}>
          <TrashIcon size={20} className="delete-recipe__icon" aria-hidden="true" />
          {deleting ? 'Deleting…' : 'Delete recipe'}
        </Button>
        <Button block onClick={onClose} disabled={deleting}>
          Keep it
        </Button>
      </div>
    </BottomSheet>
  )
}
