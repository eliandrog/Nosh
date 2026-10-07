import { useId, useState } from 'react'
import type { Tag } from '../../api/types'
import { PlusIcon } from '../icons'
import { Chip } from '../ui'

type TagPickerProps = {
  available: Tag[]
  selected: string[] // tag names, sent as-is; the API creates unknown ones
  onChange: (selected: string[]) => void
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Existing tags as toggles, plus "+ New tag" to type a new one. */
export function TagPicker({ available, selected, onChange }: TagPickerProps) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const inputId = useId()

  const names = [...available.map((t) => t.name), ...selected.filter((s) => !available.some((t) => same(t.name, s)))]
  const isSelected = (name: string) => selected.some((s) => same(s, name))
  const toggle = (name: string) => onChange(isSelected(name) ? selected.filter((s) => !same(s, name)) : [...selected, name])

  const addDraft = () => {
    const name = draft.trim().replace(/\s+/g, ' ')
    if (name && !isSelected(name)) onChange([...selected, name])
    setDraft('')
    setAdding(false)
  }

  return (
    <fieldset className="form-field">
      <legend className="form-label">Tags (optional)</legend>
      <div className="pill-row">
        {names.map((name) => (
          <Chip key={name.toLowerCase()} variant="option" selected={isSelected(name)} onClick={() => toggle(name)}>
            {name}
          </Chip>
        ))}
        {!adding && (
          <button type="button" className="new-tag-btn" onClick={() => setAdding(true)}>
            <PlusIcon size={16} /> New tag
          </button>
        )}
      </div>
      {adding && (
        <div className="new-tag">
          <label htmlFor={inputId} className="visually-hidden">
            New tag name
          </label>
          <input
            id={inputId}
            className="text-input"
            value={draft}
            maxLength={40}
            placeholder="e.g. Low cost"
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDraft()
              } else if (e.key === 'Escape') {
                setAdding(false)
              }
            }}
          />
          <button type="button" className="btn btn--outline" onClick={addDraft}>
            Add
          </button>
        </div>
      )}
    </fieldset>
  )
}
