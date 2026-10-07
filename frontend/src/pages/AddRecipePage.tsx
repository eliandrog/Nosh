import { useNavigate } from 'react-router'
import { api } from '../api/endpoints'
import { RecipeEditor } from '../components/recipe-form/RecipeEditor'
import { emptyForm } from '../components/recipe-form/recipeForm'

export function AddRecipePage() {
  const navigate = useNavigate()
  return (
    <RecipeEditor
      title="New recipe"
      initial={emptyForm()}
      cancelTo="/recipes"
      onSave={async (payload) => {
        const saved = await api.createRecipe(payload)
        navigate(`/recipes?q=${encodeURIComponent(saved.name)}`)
      }}
    />
  )
}
