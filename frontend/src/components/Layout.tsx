import type { ReactNode } from 'react'
import { Outlet } from 'react-router'
import { TabBar } from './TabBar'
import './Layout.css'

export function Layout() {
  return (
    <div className="app">
      <main className="app__main">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}

type PageHeaderProps = { title: string; subtitle?: string; logo?: ReactNode }

/** `logo` (optional) sits left of the title on the same row; it must be decorative (alt=""). */
export function PageHeader({ title, subtitle, logo }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__row">
        {logo}
        <h1 className="page-header__title">{title}</h1>
      </div>
      {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
    </header>
  )
}
