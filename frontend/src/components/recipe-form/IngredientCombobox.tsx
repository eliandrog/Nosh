import { useEffect, useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { errorMessage } from '../../api/client'
import { api } from '../../api/endpoints'
import type { IngredientSuggestion } from '../../api/types'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { PlusIcon } from '../icons'

export const SUGGEST_DELAY_MS = 250

export type IngredientValue = { ingredientId: number | null; item: string }

type Option = { kind: 'existing'; ingredient: IngredientSuggestion } | { kind: 'add'; name: string }

/** Matching ingredients for the text, fetched once typing pauses. Replies to older text are ignored. */
function useSuggestions(text: string): { q: string; items: IngredientSuggestion[] } | null {
  const q = useDebouncedValue(text.trim(), SUGGEST_DELAY_MS)
  const [results, setResults] = useState<{ q: string; items: IngredientSuggestion[] } | null>(null)

  useEffect(() => {
    if (!q) return
    let cancelled = false
    api
      .searchIngredients(q)
      .then((items) => !cancelled && setResults({ q, items }))
      .catch(() => !cancelled && setResults({ q, items: [] })) // still offer "add new"
    return () => {
      cancelled = true
    }
  }, [q])

  return results && results.q === text.trim() ? results : null
}

type Props = {
  id: string
  label: string
  value: IngredientValue
  invalid: boolean
  onChange: (value: IngredientValue) => void
}

/**
 * Ingredient field: a WAI-ARIA combobox listing existing ingredients, with
 * "+ Add “…” as a new ingredient" when nothing matches exactly. Arrow keys, Enter and Escape work.
 */
export function IngredientCombobox({ id, label, value, invalid, onChange }: Props) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [note, setNote] = useState<string>()
  const [adding, setAdding] = useState(false)
  const text = value.item
  const suggestions = useSuggestions(text)

  const typed = text.trim()
  const exact = suggestions?.items.some((s) => s.name.toLowerCase() === typed.toLowerCase()) ?? false
  const options: Option[] = suggestions
    ? [
        ...suggestions.items.map((ingredient): Option => ({ kind: 'existing', ingredient })),
        ...(typed && !exact ? [{ kind: 'add', name: typed } as Option] : []),
      ]
    : []
  const expanded = open && options.length > 0 && value.ingredientId === null
  const activeIndex = Math.min(active, options.length - 1)
  const optionId = (i: number) => `${listId}-option-${i}`

  const choose = (option: Option) => {
    setOpen(false)
    if (option.kind === 'existing') {
      onChange({ ingredientId: option.ingredient.id, item: option.ingredient.name })
      return
    }
    setAdding(true)
    api
      .createIngredient(option.name)
      .then((result) => {
        onChange({ ingredientId: result.id, item: result.name })
        setNote(result.created ? undefined : `Using existing: ${result.name}`)
      })
      .catch((e) => setNote(errorMessage(e, "Couldn't add that ingredient")))
      .finally(() => setAdding(false))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!expanded) {
        setOpen(true) // first press just reopens the list on the current option
        return
      }
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % options.length : (i - 1 + options.length) % options.length))
    } else if (e.key === 'Enter' && expanded) {
      e.preventDefault() // pick, don't submit the form
      choose(options[activeIndex])
    } else if (e.key === 'Escape' && expanded) {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="combobox">
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <input
        id={id}
        className="text-input combobox__input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded ? optionId(activeIndex) : undefined}
        aria-invalid={invalid}
        aria-busy={adding}
        placeholder="Ingredient"
        autoComplete="off"
        value={text}
        disabled={adding}
        onChange={(e) => {
          onChange({ ingredientId: null, item: e.target.value }) // editing clears the picked ingredient
          setNote(undefined)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul id={listId} role="listbox" aria-label={`${label} suggestions`} className="combobox__list" hidden={!expanded}>
        {expanded &&
          options.map((option, i) => (
            <li
              key={option.kind === 'existing' ? option.ingredient.id : 'add'}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              className={`combobox__option${option.kind === 'add' ? ' combobox__option--add' : ''}`}
              onMouseDown={(e) => e.preventDefault()} // keep focus in the field
              onClick={() => choose(option)}
            >
              {option.kind === 'existing' ? (
                option.ingredient.name
              ) : (
                <>
                  <PlusIcon size={16} /> Add “{option.name}” as a new ingredient
                </>
              )}
            </li>
          ))}
      </ul>
      {note && (
        <p className="combobox__note" role="status">
          {note}
        </p>
      )}
    </div>
  )
}
