import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/endpoints'
import type { IngredientSuggestion } from '../../api/types'
import { IngredientCombobox, SUGGEST_DELAY_MS } from './IngredientCombobox'
import type { IngredientValue } from './IngredientCombobox'

vi.mock('../../api/endpoints', () => ({ api: { searchIngredients: vi.fn(), createIngredient: vi.fn() } }))
const search = vi.mocked(api.searchIngredients)
const create = vi.mocked(api.createIngredient)

const ONION: IngredientSuggestion = { id: 2, name: 'onion' }
const RED_ONION: IngredientSuggestion = { id: 9, name: 'red onion' }

/** Holds the value like the recipe form does, and exposes the latest one for assertions. */
function renderCombobox() {
  const latest: { value: IngredientValue } = { value: { ingredientId: null, item: '' } }
  function Harness() {
    const [value, setValue] = useState<IngredientValue>(latest.value)
    return (
      <IngredientCombobox
        id="ing-1"
        label="Ingredient 1"
        value={value}
        invalid={false}
        onChange={(v) => {
          latest.value = v
          setValue(v)
        }}
      />
    )
  }
  render(<Harness />)
  return { latest, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) }
}

const field = () => screen.getByRole('combobox', { name: 'Ingredient 1' })
const waitForSuggestions = () => act(() => vi.advanceTimersByTimeAsync(SUGGEST_DELAY_MS))

describe('IngredientCombobox', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    search.mockReset()
    create.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('lists matching ingredients and picks one by tap, storing its id', async () => {
    search.mockResolvedValue([ONION, RED_ONION])
    const { latest, user } = renderCombobox()

    await user.type(field(), 'oni')
    await waitForSuggestions()
    expect(search).toHaveBeenCalledTimes(1) // once typing pauses, not per letter
    expect(field()).toHaveAttribute('aria-expanded', 'true')

    await user.click(await screen.findByRole('option', { name: 'onion' }))
    expect(latest.value).toEqual({ ingredientId: 2, item: 'onion' })
    expect(field()).toHaveAttribute('aria-expanded', 'false')
  })

  it('works with the keyboard: arrows move, Enter picks, Escape closes', async () => {
    search.mockResolvedValue([ONION, RED_ONION])
    const { latest, user } = renderCombobox()

    await user.type(field(), 'oni')
    await waitForSuggestions()
    await screen.findByRole('option', { name: 'onion' })
    await user.keyboard('{ArrowDown}')
    expect(field()).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'red onion' }).id)
    await user.keyboard('{Escape}')
    expect(field()).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('{ArrowDown}') // reopens on the same option
    expect(field()).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Enter}')
    expect(latest.value).toEqual({ ingredientId: 9, item: 'red onion' })
  })

  it('offers to add a new ingredient when nothing matches exactly, and selects it', async () => {
    search.mockResolvedValue([])
    create.mockResolvedValue({ id: 80, name: 'pak choi', created: true })
    const { latest, user } = renderCombobox()

    await user.type(field(), 'pak choi')
    await waitForSuggestions()
    await user.click(await screen.findByRole('option', { name: /Add “pak choi” as a new ingredient/ }))

    expect(create).toHaveBeenCalledWith('pak choi')
    expect(latest.value).toEqual({ ingredientId: 80, item: 'pak choi' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('says when an added name matched an existing ingredient', async () => {
    search.mockResolvedValue([RED_ONION]) // "red onion" isn't an exact match for "Onions"
    create.mockResolvedValue({ id: 2, name: 'onion', created: false })
    const { latest, user } = renderCombobox()

    await user.type(field(), 'Onions')
    await waitForSuggestions()
    await user.click(await screen.findByRole('option', { name: /Add “Onions”/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Using existing: onion')
    expect(latest.value).toEqual({ ingredientId: 2, item: 'onion' })
  })

  it('typing again clears the picked ingredient', async () => {
    search.mockResolvedValue([ONION])
    const { latest, user } = renderCombobox()
    await user.type(field(), 'onion')
    await waitForSuggestions()
    await user.click(await screen.findByRole('option', { name: 'onion' }))

    await user.type(field(), 's')
    expect(latest.value).toEqual({ ingredientId: null, item: 'onions' })
  })

  it('ignores a slow reply for older text', async () => {
    let resolveOld!: (items: IngredientSuggestion[]) => void
    search
      .mockReturnValueOnce(new Promise((r) => (resolveOld = r)))
      .mockResolvedValueOnce([RED_ONION])
    const { user } = renderCombobox()

    await user.type(field(), 'on')
    await waitForSuggestions()
    await user.type(field(), 'ion red')
    await waitForSuggestions()
    expect(await screen.findByRole('option', { name: 'red onion' })).toBeInTheDocument()

    await act(async () => resolveOld([ONION])) // late reply for "on"
    expect(screen.queryByRole('option', { name: 'onion' })).not.toBeInTheDocument()
  })
})
