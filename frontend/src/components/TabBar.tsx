import { NavLink } from 'react-router'
import { BowlIcon, CalendarIcon, CartIcon, UserIcon } from './icons'
import './TabBar.css'

const TABS = [
  { to: '/recipes', label: 'Recipes', Icon: BowlIcon },
  { to: '/week', label: 'Week', Icon: CalendarIcon },
  { to: '/shopping', label: 'Shopping', Icon: CartIcon },
  { to: '/settings', label: 'Me', Icon: UserIcon },
]

export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `tab${isActive ? ' tab--active' : ''}`}>
          <Icon size={24} />
          <span className="tab__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
