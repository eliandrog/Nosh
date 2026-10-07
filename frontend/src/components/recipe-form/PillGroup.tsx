import { Chip } from '../ui'
import { FieldError } from './FormMessages'

type PillGroupProps<T extends string> = {
  legend: string
  options: readonly T[]
  labels: Record<T, string>
  selected: readonly T[]
  onChange: (selected: T[]) => void
  error?: string
  errorId: string
}

/** Multi-select pills (selected = Charcoal + ✓) inside a labelled fieldset. */
export function PillGroup<T extends string>({ legend, options, labels, selected, onChange, error, errorId }: PillGroupProps<T>) {
  const toggle = (value: T) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : options.filter((o) => o === value || selected.includes(o)))
  return (
    <fieldset className="form-field" aria-describedby={error ? errorId : undefined}>
      <legend className="form-label">{legend}</legend>
      <div className="pill-row">
        {options.map((value) => (
          <Chip key={value} variant="option" selected={selected.includes(value)} onClick={() => toggle(value)}>
            {labels[value]}
          </Chip>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  )
}
