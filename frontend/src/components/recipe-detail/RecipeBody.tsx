import type { RecipeDetail } from '../../api/types'
import { amountLabel } from '../../lib/amounts'
import { DIETARY_LABELS } from '../recipe-form/recipeForm'
import { Chip } from '../ui'

/** Dietary labels (Leaf) then tags (green tint). */
export function RecipeLabels({ recipe }: { recipe: RecipeDetail }) {
  if (recipe.dietary.length === 0 && recipe.tags.length === 0) return null
  return (
    <ul className="recipe-labels" aria-label="Labels">
      {recipe.dietary.map((d) => (
        <li key={d}>
          <Chip variant="dietary">{DIETARY_LABELS[d]}</Chip>
        </li>
      ))}
      {recipe.tags.map((t) => (
        <li key={t.key}>
          <Chip variant="tag">{t.name}</Chip>
        </li>
      ))}
    </ul>
  )
}

export function IngredientList({ recipe, updating = false }: { recipe: RecipeDetail; updating?: boolean }) {
  return (
    <section
      className={`recipe-card-block${updating ? ' recipe-card-block--updating' : ''}`}
      aria-labelledby="ingredients-title"
      aria-busy={updating}
    >
      <h2 id="ingredients-title" className="recipe-card-block__title">
        Ingredients
      </h2>
      <ul className="ingredient-list">
        {recipe.ingredients.map((line, i) => (
          <li key={`${line.ingredientId}-${i}`} className="ingredient-line">
            <span className="ingredient-line__amount">{amountLabel(line.quantity, line.unit)}</span>
            <span>
              {line.item}
              {line.prep ? `, ${line.prep}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function MethodList({ recipe }: { recipe: RecipeDetail }) {
  return (
    <section className="recipe-card-block" aria-labelledby="method-title">
      <h2 id="method-title" className="recipe-card-block__title">
        Method
      </h2>
      <ol className="method-list">
        {recipe.method.map((step, i) => (
          <li key={i} className="method-step">
            <span className="method-step__number" aria-hidden="true">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
