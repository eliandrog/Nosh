import { useEffect, useState } from 'react'
import { errorMessage } from '../../api/client'
import { api } from '../../api/endpoints'
import type { Preferences, Profile } from '../../api/types'
import { PageHeader } from '../../components/Layout'
import { AboutNosh, APP_VERSION } from '../../components/settings/AboutNosh'
import { dietarySummary } from '../../components/settings/dietary'
import { EditProfileSheet } from '../../components/settings/EditProfileSheet'
import type { ProfileField } from '../../components/settings/EditProfileSheet'
import { SettingsGroup, SettingsRow } from '../../components/settings/SettingsRow'
import { Button } from '../../components/ui'
import './settings.css'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: Profile; preferences: Preferences }

function initials(name: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return parts.length ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() : '?'
}

const notSet = <span className="settings-row__placeholder">Not set</span>

export function SettingsPage() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [editing, setEditing] = useState<ProfileField | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getProfile(), api.getPreferences()])
      .then(([profile, preferences]) => !cancelled && setState({ status: 'ready', profile, preferences }))
      .catch((e) => !cancelled && setState({ status: 'error', message: errorMessage(e, 'Something went wrong loading your settings') }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  if (state.status === 'loading') {
    return (
      <>
        <PageHeader title="Settings" />
        <p className="settings__note">Loading your settings…</p>
      </>
    )
  }

  if (state.status === 'error') {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="settings__note" role="alert">
          <p>{state.message}</p>
          <Button variant="outline" onClick={() => { setState({ status: 'loading' }); setAttempt((a) => a + 1) }}>
            Try again
          </Button>
        </div>
      </>
    )
  }

  const { profile, preferences } = state
  const saveProfile = async (next: Profile) => {
    const saved = await api.updateProfile({ name: next.name, email: next.email, householdSize: next.householdSize })
    setState({ status: 'ready', profile: saved, preferences })
  }

  return (
    <>
      <PageHeader title="Settings" />

      <div className="profile-card">
        <span className="profile-card__avatar" aria-hidden="true">
          {initials(profile.name)}
        </span>
        <span className="profile-card__text">
          <span className="profile-card__name">{profile.name ?? 'Add your name'}</span>
          {profile.email && <span className="profile-card__email">{profile.email}</span>}
        </span>
      </div>

      <SettingsGroup title="Your details">
        <SettingsRow label="Name" value={profile.name ?? notSet} onClick={() => setEditing('name')} />
        <SettingsRow label="Email" value={profile.email ?? notSet} onClick={() => setEditing('email')} />
        <SettingsRow
          label="Household size"
          value={profile.householdSize ? `${profile.householdSize} ${profile.householdSize === 1 ? 'person' : 'people'}` : notSet}
          onClick={() => setEditing('householdSize')}
        />
      </SettingsGroup>

      <SettingsGroup title="Food">
        <SettingsRow label="Dietary preferences" value={dietarySummary(preferences.dietary)} to="/settings/dietary" />
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsRow label="App version" value={APP_VERSION} />
      </SettingsGroup>

      <AboutNosh id="about-nosh" />

      <EditProfileSheet field={editing} profile={profile} onSave={saveProfile} onClose={() => setEditing(null)} />
    </>
  )
}
