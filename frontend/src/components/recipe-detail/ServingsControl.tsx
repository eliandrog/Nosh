import { Stepper } from '../ui'

type Props = {
  servings: number
  serves: number
  scaling: boolean
  onChange: (servings: number) => void
}

export const MAX_SERVINGS = 20

/** "Servings − N +" above the ingredients; the amounts below follow the chosen number. */
export function ServingsControl({ servings, serves, scaling, onChange }: Props) {
  return (
    <div className="servings-control">
      <span className="servings-control__label">Servings</span>
      <Stepper label="Servings" value={servings} min={1} max={MAX_SERVINGS} onChange={onChange} />
      <span className="servings-control__hint" aria-live="polite">
        {scaling ? 'Updating amounts…' : servings !== serves ? `Scaled from serves ${serves}` : `Recipe serves ${serves}`}
      </span>
    </div>
  )
}
