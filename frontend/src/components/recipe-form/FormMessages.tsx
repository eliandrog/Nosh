import { WarningIcon } from '../icons'

/** Inline field error: coral icon, Charcoal text (coral text fails AA). */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="field-error">
      <WarningIcon size={16} className="field-error__icon" aria-hidden="true" />
      {message}
    </p>
  )
}

/** Banner at the top of the form after a failed save attempt. */
export function ErrorSummary({ count, message }: { count: number; message?: string }) {
  if (count === 0 && !message) return null
  const text =
    message ?? `Nearly there. ${count} ${count === 1 ? 'thing' : 'things'} to add before saving.`
  return (
    <div className="error-summary" role="alert">
      <WarningIcon size={20} className="field-error__icon" aria-hidden="true" />
      <p>{text}</p>
    </div>
  )
}
