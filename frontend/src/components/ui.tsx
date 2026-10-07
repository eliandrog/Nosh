import { useEffect, useId, useRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { MinusIcon, PlusIcon } from './icons'
import './ui.css'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline'
  block?: boolean
}

/** Primary = Nosh Green with Charcoal text (never white: fails AA). Outline = secondary action. */
export function Button({ variant = 'primary', block = false, className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant}${block ? ' btn--block' : ''} ${className}`.trim()}
      {...rest}
    />
  )
}

type RoundIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  children: ReactNode
  tone?: 'white' | 'surface' | 'green'
}

/** 44px round icon-only button; `label` becomes the accessible name. */
export function RoundIconButton({ label, children, tone = 'white', className = '', type = 'button', ...rest }: RoundIconButtonProps) {
  return (
    <button type={type} aria-label={label} className={`icon-btn icon-btn--${tone} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}

/**
 * Chip variants (TECHNICAL.md colour meanings):
 * dietary = Leaf, tag = green tint, status = Charcoal badge, selected = Charcoal + ✓ (filters/options).
 */
export type ChipVariant = 'dietary' | 'tag' | 'status' | 'option'

type ChipProps = {
  variant: ChipVariant
  children: ReactNode
  selected?: boolean
  onClick?: () => void
}

export function Chip({ variant, children, selected = false, onClick }: ChipProps) {
  if (variant === 'option') {
    return (
      <button type="button" className={`chip chip--option${selected ? ' chip--selected' : ''}`} aria-pressed={selected} onClick={onClick}>
        {selected && <span aria-hidden="true">✓ </span>}
        {children}
      </button>
    )
  }
  return <span className={`chip chip--${variant}`}>{children}</span>
}

type StepperProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label: string
}

export function Stepper({ value, onChange, min = 1, max = 99, label }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper__btn" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <MinusIcon size={22} />
      </button>
      <output className="stepper__value" aria-live="polite">
        {value}
      </output>
      <button type="button" className="stepper__btn" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <PlusIcon size={22} />
      </button>
    </div>
  )
}

type BottomSheetProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Slide-up panel over a scrim. Closes on scrim tap or Escape; focus moves into the sheet. */
export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const titleId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    sheetRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheet-root">
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={sheetRef}>
        <div className="sheet__handle" aria-hidden="true" />
        <h2 id={titleId} className="sheet__title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
