import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../../api/client'
import { api } from '../../api/endpoints'
import type { DietaryLabel } from '../../api/types'
import { ChevronLeftIcon, WarningIcon } from '../../components/icons'
import { PageHeader } from '../../components/Layout'
import { DIETARY_OPTIONS } from '../../components/settings/dietary'
import { Switch } from '../../components/settings/Switch'
import { Button } from '../../components/ui'
import './settings.css'

type Counts = { suitable: number; total: number }

/** How many recipes suit these labels, out of all recipes. */
async function countRecipes(dietary: DietaryLabel[]): Promise<Counts> {
  const [suitable, all] = await Promise.all([api.listRecipes({ dietary }), api.listRecipes({ all: true })])
  return { suitable: suitable.length, total: all.length }
}

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; selected: DietaryLabel[] }

export function DietaryPreferencesPage() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [counts, setCounts] = useState<Counts | null>(null)
  const [saveError, setSaveError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .getPreferences()
      .then(async ({ dietary }) => {
        if (cancelled) return
        setState({ status: 'ready', selected: dietary })
        const c = await countRecipes(dietary)
        if (!cancelled) setCounts(c)
      })
      .catch((e) => !cancelled && setState({ status: 'error', message: errorMessage(e, 'Something went wrong loading your preferences') }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const toggle = async (label: DietaryLabel, on: boolean) => {
    if (state.status !== 'ready') return
    const previous = state.selected
    const next = DIETARY_OPTIONS.map((o) => o.label).filter((l) => (l === label ? on : previous.includes(l)))
    setState({ status: 'ready', selected: next }) // optimistic: the switch moves straight away
    setSaveError(undefined)
    setSaving(true)
    try {
      const saved = await api.updatePreferences({ dietary: next })
      setState({ status: 'ready', selected: saved.dietary })
      setCounts(await countRecipes(saved.dietary))
    } catch (e) {
      setState({ status: 'ready', selected: previous }) // put it back if saving failed
      setSaveError(errorMessage(e, "Couldn't save your preferences. Please try again."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Link to="/settings" className="back-link">
        <ChevronLeftIcon size={20} /> Settings
      </Link>
      <PageHeader title="Dietary preferences" subtitle="We'll only show recipes that suit you. Change these any time." />

      {state.status === 'loading' && <p className="settings__note">Loading your preferences…</p>}

      {state.status === 'error' && (
        <div className="settings__note" role="alert">
          <p>{state.message}</p>
          <Button variant="outline" onClick={() => { setState({ status: 'loading' }); setAttempt((a) => a + 1) }}>
            Try again
          </Button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <section className="settings-group" aria-label="Dietary needs">
            <h2 className="settings-group__title">Dietary needs</h2>
            <div className="settings-group__card">
              {DIETARY_OPTIONS.map((o) => (
                <Switch
                  key={o.label}
                  name={o.name}
                  description={o.description}
                  checked={state.selected.includes(o.label)}
                  disabled={saving}
                  onChange={(on) => toggle(o.label, on)}
                />
              ))}
            </div>
          </section>

          {saveError && (
            <p className="settings-notice settings-notice--error" role="alert">
              <WarningIcon size={18} className="settings-notice__icon" />
              {saveError}
            </p>
          )}

          <p className="settings-notice">
            <WarningIcon size={18} className="settings-notice__icon" />
            Recipes are a guide. For allergies, always check the packet labels.
          </p>

          {counts && (
            <div className="suit-summary" aria-live="polite">
              <p className="suit-summary__title">
                {counts.suitable} of {counts.total} recipes suit you
              </p>
            </div>
          )}
        </>
      )}
    </>
  )
}
