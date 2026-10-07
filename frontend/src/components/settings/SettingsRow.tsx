import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRightIcon } from '../icons'

type SettingsRowProps = {
  label: string
  value?: ReactNode
  /** Navigate on tap. */
  to?: string
  /** Run an action on tap (e.g. open an editor). */
  onClick?: () => void
}

/** One row in a settings group: a link, a button (both show a chevron), or read-only. */
export function SettingsRow({ label, value, to, onClick }: SettingsRowProps) {
  const content = (
    <>
      <span className="settings-row__label">{label}</span>
      {value !== undefined && <span className="settings-row__value">{value}</span>}
      {(to || onClick) && <ChevronRightIcon size={20} className="settings-row__chevron" />}
    </>
  )
  if (to) {
    return (
      <Link to={to} className="settings-row settings-row--action">
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className="settings-row settings-row--action" onClick={onClick}>
        {content}
      </button>
    )
  }
  return <div className="settings-row">{content}</div>
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-group" aria-label={title}>
      <h2 className="settings-group__title">{title}</h2>
      <div className="settings-group__card">{children}</div>
    </section>
  )
}
