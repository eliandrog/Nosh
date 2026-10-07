import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { errorMessage } from '../api/client'
import { api } from '../api/endpoints'
import type { ShoppingItem, ShoppingList } from '../api/types'
import { PageHeader } from '../components/Layout'
import { CloseIcon, RefreshIcon } from '../components/icons'
import { ShoppingItemRow } from '../components/shopping/ShoppingItemRow'
import { Button } from '../components/ui'
import { WeekNavigator } from '../components/week/WeekNavigator'
import { isValidIsoDate, mondayOf, today } from '../lib/dates'
import type { IsoDate } from '../lib/dates'
import { changesSummary } from '../lib/shopping'
import '../components/week/Week.css'
import '../components/shopping/Shopping.css'

type Loaded = { list: ShoppingList; meals: number }
type State = { status: 'loading' } | { status: 'error'; message: string } | ({ status: 'ready' } & Loaded)

export function ShoppingPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('week')
  const monday = mondayOf(isValidIsoDate(requested) ? requested : today())
  const [state, setState] = useState<State>({ status: 'loading' })
  const [reload, setReload] = useState(0)
  const [actionError, setActionError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getShoppingList(monday), api.getWeekPlan(monday)])
      .then(([list, week]) => {
        if (cancelled) return
        setState({ status: 'ready', list, meals: week.days.reduce((n, d) => n + d.entries.length, 0) })
      })
      .catch((e) => !cancelled && setState({ status: 'error', message: errorMessage(e, "Couldn't load your shopping list") }))
    return () => {
      cancelled = true
    }
  }, [monday, reload])

  const goToWeek = (next: IsoDate) => setParams(next === mondayOf(today()) ? {} : { week: next })

  /** Shows the change straight away; puts it back if the server says no. */
  const optimistic = async (update: (list: ShoppingList) => ShoppingList, request: () => Promise<unknown>) => {
    if (state.status !== 'ready') return
    const before = state.list
    setActionError(undefined)
    setState({ ...state, list: update(before) })
    try {
      await request()
    } catch (e) {
      setState((s) => (s.status === 'ready' ? { ...s, list: before } : s))
      setActionError(errorMessage(e, "Couldn't save that change. Please try again."))
    }
  }

  const toggle = (item: ShoppingItem) =>
    optimistic(
      (list) => ({ ...list, items: list.items.map((i) => (i.id === item.id ? { ...i, ticked: !i.ticked } : i)) }),
      () => api.setTicked(item.id, !item.ticked),
    )
  const clearTicked = () =>
    optimistic((list) => ({ ...list, items: list.items.map((i) => ({ ...i, ticked: false })) }), () => api.clearTicked(monday))
  const dismiss = () => optimistic((list) => ({ ...list, changes: null }), () => api.dismissChanges(monday))

  const meals = state.status === 'ready' ? state.meals : 0
  return (
    <>
      <PageHeader
        title="Shopping list"
        subtitle={meals ? `Everything for your ${meals} planned ${meals === 1 ? 'meal' : 'meals'}, added up.` : undefined}
      />
      <WeekNavigator monday={monday} onChange={goToWeek} />
      {actionError && (
        <p className="shop__error" role="alert">
          {actionError}
        </p>
      )}

      {state.status === 'loading' && <p className="shop__note">Loading your list…</p>}
      {state.status === 'error' && (
        <div className="shop__note" role="alert">
          <p>{state.message}</p>
          <Button variant="outline" onClick={() => { setState({ status: 'loading' }); setReload((n) => n + 1) }}>
            Try again
          </Button>
        </div>
      )}

      {state.status === 'ready' && state.list.items.length === 0 && (
        <div className="shop__note">
          <p>Nothing to buy yet. Plan some meals for this week and your list will fill itself in.</p>
          <Link to={monday === mondayOf(today()) ? '/week' : `/week?week=${monday}`} className="btn btn--primary btn--block">
            Plan meals
          </Link>
        </div>
      )}

      {state.status === 'ready' && state.list.items.length > 0 && (
        <>
          {state.list.changes && (
            <div className="shop__banner" role="status">
              <RefreshIcon size={20} className="shop__banner-icon" />
              <span className="shop__banner-text">
                <span className="shop__banner-title">List updated for your new plan</span>
                <span>{changesSummary(state.list.changes)} Things you already ticked stay ticked.</span>
              </span>
              <button type="button" className="shop__banner-close" aria-label="Dismiss" onClick={dismiss}>
                <CloseIcon size={18} />
              </button>
            </div>
          )}
          <Progress items={state.list.items} onClear={clearTicked} />
          <ul className="shop__list" aria-label="Shopping list">
            {state.list.items.map((item) => (
              <ShoppingItemRow key={item.id} item={item} onToggle={toggle} />
            ))}
          </ul>
          <p className="shop__tip">
            <span aria-hidden="true">💡</span> Already got some of these? Tick them off before you shop.
          </p>
        </>
      )}
    </>
  )
}

function Progress({ items, onClear }: { items: ShoppingItem[]; onClear: () => void }) {
  const ticked = items.filter((i) => i.ticked).length
  return (
    <div className="shop__progress">
      <span aria-live="polite">
        {ticked} of {items.length} in the basket
      </span>
      <button type="button" className="shop__clear" onClick={onClear} disabled={ticked === 0}>
        Clear ticked
      </button>
    </div>
  )
}
