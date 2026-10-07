import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import './Pagination.css'

type PaginationProps = {
  page: number
  totalPages: number
  onChange: (page: number) => void
  /** Names the control for screen readers, e.g. "Recipe pages". */
  label: string
}

/** Previous / Next with "Page 2 of 4". Hidden when everything fits on one page. */
export function Pagination({ page, totalPages, onChange, label }: PaginationProps) {
  if (totalPages <= 1) return null
  const isFirst = page <= 1
  const isLast = page >= totalPages
  return (
    <nav className="pagination" aria-label={label}>
      <button
        type="button"
        className="pagination__button"
        aria-label="Previous page"
        disabled={isFirst}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeftIcon size={18} aria-hidden="true" /> Previous
      </button>
      <span className="pagination__status" aria-live="polite">
        Page {Math.min(page, totalPages)} of {totalPages}
      </span>
      <button
        type="button"
        className="pagination__button"
        aria-label="Next page"
        disabled={isLast}
        onClick={() => onChange(page + 1)}
      >
        Next <ChevronRightIcon size={18} aria-hidden="true" />
      </button>
    </nav>
  )
}
