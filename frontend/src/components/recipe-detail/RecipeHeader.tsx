import { Link } from 'react-router'
import type { RecipeDetail } from '../../api/types'
import { MEAL_TYPE_LABELS, titleCase } from '../recipe-form/recipeForm'
import { ChevronLeftIcon, GlobeIcon, MealIcon, PeopleIcon } from '../icons'
import { Chip } from '../ui'

/** Mint header: back button, image, name, "Your recipe" badge and the cuisine / serves / meal facts. */
export function RecipeHeader({ recipe }: { recipe: RecipeDetail }) {
  const meals = recipe.mealTypes.map((m) => MEAL_TYPE_LABELS[m]).join(' · ')
  return (
    <header className="recipe-hero">
      <Link to="/recipes" className="icon-btn icon-btn--white" aria-label="Back to recipes">
        <ChevronLeftIcon size={22} />
      </Link>
      <span className="recipe-hero__image" aria-hidden="true">
        {recipe.imageUrl ? <img src={recipe.imageUrl} alt="" /> : recipe.defaultImage}
      </span>
      {recipe.isCustom && (
        <span className="recipe-hero__badge">
          <Chip variant="status">Your recipe</Chip>
        </span>
      )}
      <h1 className="recipe-hero__name">{recipe.name}</h1>
      <ul className="recipe-facts" aria-label="Recipe facts">
        <li className="recipe-fact">
          <GlobeIcon size={16} aria-hidden="true" /> {titleCase(recipe.cuisine)}
        </li>
        <li className="recipe-fact">
          <PeopleIcon size={16} aria-hidden="true" /> Serves {recipe.serves}
        </li>
        {meals && (
          <li className="recipe-fact">
            <MealIcon size={16} aria-hidden="true" /> {meals}
          </li>
        )}
      </ul>
    </header>
  )
}
