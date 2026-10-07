import { describe, expect, it } from 'vitest'
import type { PlanEntry } from '../api/types'
import { mealName } from './planEntry'

const base: PlanEntry = {
  id: 1,
  date: '2026-10-07',
  position: 0,
  kind: 'recipe',
  recipeId: 'id-1',
  recipeSlug: 'lentil-dahl',
  recipeName: 'Lentil Dahl',
  recipeDeleted: false,
  placeMeal: null,
  servings: 2,
}

describe('mealName', () => {
  it('uses the recipe name for recipe meals', () => {
    expect(mealName(base)).toBe('Lentil Dahl')
  })

  it('names free meals with the place they come from', () => {
    const free: PlanEntry = {
      ...base,
      kind: 'free_meal',
      recipeId: null,
      recipeSlug: null,
      recipeName: null,
      placeMeal: {
        id: 1,
        name: 'Vegetable curry with rice',
        kind: 'hot',
        placeId: 1,
        placeName: 'Demo Community Kitchen',
        startTime: '12:00:00',
        endTime: '14:00:00',
      },
    }
    expect(mealName(free)).toBe('Vegetable curry with rice (Demo Community Kitchen)')
  })
})
