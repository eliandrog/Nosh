import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { errorMessage } from '../api/client'
import { api } from '../api/endpoints'
import type { PlanEntry, WeekPlan } from '../api/types'
import { PageHeader } from '../components/Layout'
import { Button } from '../components/ui'
import { DayCard } from '../components/week/DayCard'
import { MealOptionsSheet } from '../components/week/MealOptionsSheet'
import { WeekNavigator } from '../components/week/WeekNavigator'
import { isValidIsoDate, mondayOf, relativeWeekLabel, today } from '../lib/dates'
import type { IsoDate } from '../lib/dates'
import '../components/week/Week.css'

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; week: WeekPlan }

export function WeekPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('week')
  const monday = mondayOf(isValidIsoDate(requested) ? requested : today())
  const [state, setState] = useState<State>({ status: 'loading' })
  const [reload, setReload] = useState(0)
  const [openEntryId, setOpenEntryId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    api
      .getWeekPlan(monday)
      .then((week) => !cancelled && setState({ status: 'ready', week }))
      .catch((e) => !cancelled && setState({ status: 'error', message: errorMessage(e, "Couldn't load your week") }))
    return () => {
      cancelled = true
    }
  }, [monday, reload])

  const goToWeek = (next: IsoDate) => setParams(next === mondayOf(today()) ? {} : { week: next })
  const entries = state.status === 'ready' ? state.week.days.flatMap((d) => d.entries) : []
  const openEntry = entries.find((e) => e.id === openEntryId) ?? null

  /** Runs a change, then reloads the week so order and positions come from the server. */
  const change = async (action: () => Promise<unknown>, close = false) => {
    setBusy(true)
    setActionError(undefined)
    try {
      await action()
      if (close) setOpenEntryId(null)
      setReload((n) => n + 1)
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const relative = relativeWeekLabel(monday)
  const planned = entries.length
  return (
    <>
      <PageHeader
        title={relative || 'Week plan'}
        subtitle={planned ? `${planned} ${planned === 1 ? 'meal' : 'meals'} planned. Tap a meal to change it.` : 'Add as many meals a day as suits you.'}
      />
      <WeekNavigator monday={monday} onChange={goToWeek} />
      <Link to="/free-meals" className="free-meals-card">
        <span>
          Free meals near you
          <span className="free-meals-card__sub">Meals shared by local community places</span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>
      {actionError && (
        <p className="week__error" role="alert">
          {actionError}
        </p>
      )}

      {state.status === 'loading' && <p className="week__note">Loading your week…</p>}
      {state.status === 'error' && (
        <div className="week__note" role="alert">
          <p>{state.message}</p>
          <Button variant="outline" onClick={() => { setState({ status: 'loading' }); setReload((n) => n + 1) }}>
            Try again
          </Button>
        </div>
      )}
      {state.status === 'ready' && (
        <div className="week__days">
          {state.week.days.map((day) => (
            <DayCard key={day.date} day={day} isToday={day.date === today()} onOpenMeal={(e: PlanEntry) => setOpenEntryId(e.id)} />
          ))}
        </div>
      )}

      <MealOptionsSheet
        key={openEntryId ?? 'none'}
        entry={openEntry}
        weekDays={state.status === 'ready' ? state.week.days.map((d) => d.date) : []}
        busy={busy}
        onClose={() => setOpenEntryId(null)}
        onServings={(servings) => openEntry && change(() => api.updatePlanEntry(openEntry.id, { servings }))}
        onMove={(date) => openEntry && change(() => api.updatePlanEntry(openEntry.id, { date }), true)}
        onSwap={(recipeId) => openEntry && change(() => api.updatePlanEntry(openEntry.id, { recipeId }), true)}
        onRemove={() => openEntry && change(() => api.deletePlanEntry(openEntry.id), true)}
      />
    </>
  )
}
