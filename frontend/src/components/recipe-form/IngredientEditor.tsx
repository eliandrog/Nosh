import { useId } from 'react'
import type { FieldErrors, Unit } from '../../api/types'
import { CloseIcon, PlusIcon } from '../icons'
import { FieldError } from './FormMessages'
import { IngredientCombobox } from './IngredientCombobox'
import type { IngredientRow } from './recipeForm'

const GROUP_LABELS: Record<string, string> = { weight: 'Weight', volume: 'Volume', count: 'Count', pack: 'Packs & pieces' }

type RowProps = {
  row: IngredientRow
  index: number
  units: Unit[]
  errors: FieldErrors
  canRemove: boolean
  onChange: (row: IngredientRow) => void
  onRemove: () => void
}

function IngredientRowEditor({ row, index, units, errors, canRemove, onChange, onRemove }: RowProps) {
  const id = useId()
  const n = index + 1
  const err = (field: string) => errors[`ingredients.${index}.${field}`]
  const groups = [...new Set(units.map((u) => u.group))]

  return (
    <li className="ingredient-card">
      <div className="ingredient-card__main">
        <label htmlFor={`${id}-qty`} className="visually-hidden">{`Quantity for ingredient ${n}`}</label>
        <input
          id={`${id}-qty`}
          className="text-input ingredient-card__qty"
          inputMode="decimal"
          placeholder="Qty"
          value={row.quantity}
          aria-invalid={Boolean(err('quantity'))}
          onChange={(e) => onChange({ ...row, quantity: e.target.value })}
        />
        <label htmlFor={`${id}-unit`} className="visually-hidden">{`Unit for ingredient ${n}`}</label>
        <select
          id={`${id}-unit`}
          className="text-input ingredient-card__unit"
          value={row.unit}
          aria-invalid={Boolean(err('unit'))}
          onChange={(e) => onChange({ ...row, unit: e.target.value })}
        >
          {groups.map((group) => (
            <optgroup key={group} label={GROUP_LABELS[group] ?? group}>
              {units
                .filter((u) => u.group === group)
                .map((u) => (
                  <option key={u.key ?? 'item'} value={u.key ?? ''}>
                    {u.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <IngredientCombobox
          id={`${id}-item`}
          label={`Ingredient ${n}`}
          value={{ ingredientId: row.ingredientId, item: row.item }}
          invalid={Boolean(err('item') || err('ingredientId'))}
          onChange={(v) => onChange({ ...row, ...v })}
        />
        {canRemove && (
          <button type="button" className="ingredient-card__remove" aria-label={`Remove ingredient ${n}`} onClick={onRemove}>
            <CloseIcon size={18} />
          </button>
        )}
      </div>
      <label htmlFor={`${id}-prep`} className="visually-hidden">{`Preparation for ingredient ${n} (optional)`}</label>
      <input
        id={`${id}-prep`}
        className="text-input ingredient-card__prep"
        placeholder="Prep (optional), e.g. sliced, grated"
        value={row.prep}
        onChange={(e) => onChange({ ...row, prep: e.target.value })}
      />
      {(['quantity', 'unit', 'item', 'ingredientId', 'prep'] as const).map((field) => (
        <FieldError key={field} id={`${id}-${field}-error`} message={err(field)} />
      ))}
    </li>
  )
}

type IngredientEditorProps = {
  rows: IngredientRow[]
  units: Unit[]
  errors: FieldErrors
  onChange: (rows: IngredientRow[]) => void
  onAdd: () => void
}

export function IngredientEditor({ rows, units, errors, onChange, onAdd }: IngredientEditorProps) {
  return (
    <section className="form-card" aria-labelledby="ingredients-heading">
      <h2 id="ingredients-heading" className="form-card__title">
        Ingredients
      </h2>
      <ol className="ingredient-list">
        {rows.map((row, i) => (
          <IngredientRowEditor
            key={row.id}
            row={row}
            index={i}
            units={units}
            errors={errors}
            canRemove={rows.length > 1}
            onChange={(updated) => onChange(rows.map((r) => (r.id === row.id ? updated : r)))}
            onRemove={() => onChange(rows.filter((r) => r.id !== row.id))}
          />
        ))}
      </ol>
      <FieldError id="ingredients-error" message={errors.ingredients} />
      <button type="button" className="add-row-btn" onClick={onAdd}>
        <PlusIcon size={18} /> Add ingredient
      </button>
    </section>
  )
}
