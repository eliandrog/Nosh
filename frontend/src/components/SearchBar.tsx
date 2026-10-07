import { useId, useRef } from 'react'
import { CloseIcon, SearchIcon } from './icons'
import './SearchBar.css'

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
}

/** Rounded search field with a visible clear button once there's text. `label` is for screen readers. */
export function SearchBar({ value, onChange, label, placeholder }: SearchBarProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const clear = () => {
    onChange('')
    inputRef.current?.focus() // keep typing straight after clearing
  }
  return (
    <div className="search-bar" role="search">
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <SearchIcon size={18} className="search-bar__icon" aria-hidden="true" />
      <input
        ref={inputRef}
        id={id}
        type="search"
        className="search-bar__input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && clear()}
      />
      {value && (
        <button type="button" className="search-bar__clear" aria-label="Clear search" onClick={clear}>
          <CloseIcon size={18} />
        </button>
      )}
    </div>
  )
}
