import type { FieldErrors } from '../../api/types'
import { CloseIcon, PlusIcon } from '../icons'
import { FieldError } from './FormMessages'
import type { MethodStep } from './recipeForm'

type MethodEditorProps = {
  steps: MethodStep[]
  errors: FieldErrors
  onChange: (steps: MethodStep[]) => void
  onAdd: () => void
}

/** Numbered method steps with add/remove. */
export function MethodEditor({ steps, errors, onChange, onAdd }: MethodEditorProps) {
  return (
    <section className="form-card" aria-labelledby="method-heading">
      <h2 id="method-heading" className="form-card__title">
        Method
      </h2>
      <ol className="step-list">
        {steps.map((step, i) => (
          <li key={step.id} className="step">
            <span className="step__number" aria-hidden="true">
              {i + 1}
            </span>
            <label htmlFor={step.id} className="visually-hidden">{`Step ${i + 1}`}</label>
            <textarea
              id={step.id}
              className="text-input step__text"
              rows={2}
              placeholder={i === 0 ? 'Describe the first step…' : 'Describe the next step…'}
              value={step.text}
              aria-invalid={Boolean(errors[`method.${i}`])}
              onChange={(e) => onChange(steps.map((s) => (s.id === step.id ? { ...s, text: e.target.value } : s)))}
            />
            {steps.length > 1 && (
              <button
                type="button"
                className="ingredient-card__remove"
                aria-label={`Remove step ${i + 1}`}
                onClick={() => onChange(steps.filter((s) => s.id !== step.id))}
              >
                <CloseIcon size={18} />
              </button>
            )}
            <FieldError id={`${step.id}-error`} message={errors[`method.${i}`]} />
          </li>
        ))}
      </ol>
      <FieldError id="method-error" message={errors.method} />
      <button type="button" className="add-row-btn" onClick={onAdd}>
        <PlusIcon size={18} /> Add step
      </button>
    </section>
  )
}
