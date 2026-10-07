import { useId } from 'react'

type SwitchProps = {
  name: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/** Accessible on/off switch row: the whole row is the control (44px+ tap target). */
export function Switch({ name, description, checked, disabled = false, onChange }: SwitchProps) {
  const nameId = useId()
  const descId = useId()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={nameId}
      aria-describedby={description ? descId : undefined}
      disabled={disabled}
      className="switch-row"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-row__text">
        <span id={nameId} className="switch-row__name">
          {name}
        </span>
        {description && (
          <span id={descId} className="switch-row__description">
            {description}
          </span>
        )}
      </span>
      <span className={`switch${checked ? ' switch--on' : ''}`} aria-hidden="true">
        <span className="switch__knob" />
      </span>
    </button>
  )
}
