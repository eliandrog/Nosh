import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage, ValidationError } from '../../api/client'
import type { Profile } from '../../api/types'
import { ErrorSummary, FieldError } from '../recipe-form/FormMessages'
import { BottomSheet, Button, Stepper } from '../ui'

export type ProfileField = 'name' | 'email' | 'householdSize'

const TITLES: Record<ProfileField, string> = {
  name: 'Your name',
  email: 'Your email',
  householdSize: 'Household size',
}

type EditProfileSheetProps = {
  field: ProfileField | null
  profile: Profile
  onSave: (profile: Profile) => Promise<void>
  onClose: () => void
}

/** Edits one profile field in a bottom sheet. Server field errors show under the field. */
export function EditProfileSheet({ field, profile, onSave, onClose }: EditProfileSheetProps) {
  if (!field) return null
  // Keyed by field so each open starts from the saved profile.
  return <EditorBody key={field} field={field} profile={profile} onSave={onSave} onClose={onClose} />
}

function EditorBody({ field, profile, onSave, onClose }: EditProfileSheetProps & { field: ProfileField }) {
  const inputId = useId()
  const errorId = useId()
  const [text, setText] = useState(field === 'name' ? (profile.name ?? '') : (profile.email ?? ''))
  const [size, setSize] = useState(profile.householdSize ?? 2)
  const [fieldError, setFieldError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFieldError(undefined)
    setFormError(undefined)
    const value = field === 'householdSize' ? size : text.trim() || null
    try {
      await onSave({ ...profile, [field]: value })
      onClose()
    } catch (err) {
      if (err instanceof ValidationError && err.fields[field]) setFieldError(err.fields[field])
      else setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open title={TITLES[field]} onClose={onClose}>
      <form className="profile-editor" onSubmit={submit} noValidate>
        <ErrorSummary count={0} message={formError} />
        {field === 'householdSize' ? (
          <div className="profile-editor__field">
            <Stepper label="People" value={size} min={1} max={20} onChange={setSize} />
            <p className="profile-editor__hint">Used as the default number of servings when you add a meal.</p>
            <FieldError id={errorId} message={fieldError} />
          </div>
        ) : (
          <div className="profile-editor__field">
            <label htmlFor={inputId} className="profile-editor__label">
              {field === 'name' ? 'Name' : 'Email'}
            </label>
            <input
              id={inputId}
              className="settings-input"
              type={field === 'email' ? 'email' : 'text'}
              autoComplete={field === 'email' ? 'email' : 'name'}
              value={text}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? errorId : undefined}
              onChange={(e) => setText(e.target.value)}
            />
            <FieldError id={errorId} message={fieldError} />
          </div>
        )}
        <div className="profile-editor__actions">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </BottomSheet>
  )
}
