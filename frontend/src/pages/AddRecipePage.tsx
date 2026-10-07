import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError, ValidationError, errorMessage } from '../api/client'
import { api } from '../api/endpoints'
import type { Cuisine, FieldErrors, Options, Tag, Unit } from '../api/types'
import { ErrorSummary, FieldError } from '../components/recipe-form/FormMessages'
import { IngredientEditor } from '../components/recipe-form/IngredientEditor'
import { MethodEditor } from '../components/recipe-form/MethodEditor'
import { PillGroup } from '../components/recipe-form/PillGroup'
import {
  DIETARY_LABELS,
  MEAL_TYPE_LABELS,
  emptyForm,
  emptyIngredient,
  emptyStep,
  mapServerFields,
  titleCase,
  toSubmission,
  validate,
} from '../components/recipe-form/recipeForm'
import type { RecipeForm } from '../components/recipe-form/recipeForm'
import { TagPicker } from '../components/recipe-form/TagPicker'
import { Button, Stepper } from '../components/ui'
import '../components/recipe-form/RecipeForm.css'

type Reference = { options: Options; units: Unit[]; tags: Tag[] }
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: Reference }

/** Server errors for a field path, e.g. a 409 "name taken" or 422 "ingredients.0.unit". */
function serverFields(e: unknown): FieldErrors | null {
  if (e instanceof ValidationError) return e.fields
  if (e instanceof ApiError && e.code === 'recipe_name_taken') {
    const fields = (e.details as { fields?: FieldErrors } | null)?.fields
    return fields ?? { name: e.message }
  }
  return null
}

export function AddRecipePage() {
  const navigate = useNavigate()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [form, setForm] = useState<RecipeForm>(emptyForm)
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [banner, setBanner] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getOptions(), api.getUnits(), api.listTags()])
      .then(([options, units, tags]) => !cancelled && setLoad({ status: 'ready', data: { options, units, tags } }))
      .catch((e) => !cancelled && setLoad({ status: 'error', message: errorMessage(e, "Couldn't load the form") }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  // Client checks re-run as the user fixes things; server errors clear once they edit.
  const errors: FieldErrors = submitted ? { ...validate(form), ...serverErrors } : {}
  const update = (patch: Partial<RecipeForm>) => {
    setForm((f) => ({ ...f, ...patch }))
    setServerErrors({})
    setBanner(undefined)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(validate(form)).length > 0) return

    const submission = toSubmission(form)
    setSaving(true)
    try {
      const saved = await api.createRecipe(submission.payload)
      navigate(`/recipes?q=${encodeURIComponent(saved.name)}`)
    } catch (err) {
      const fields = serverFields(err)
      if (fields) setServerErrors(mapServerFields(fields, submission))
      else setBanner(errorMessage(err, "Couldn't save your recipe. Please try again."))
      setSaving(false)
    }
  }

  if (load.status !== 'ready') {
    return (
      <div className="recipe-form__status" role={load.status === 'error' ? 'alert' : undefined}>
        {load.status === 'loading' ? (
          <p>Loading…</p>
        ) : (
          <>
            <p>{load.message}</p>
            <Button variant="outline" onClick={() => { setLoad({ status: 'loading' }); setAttempt((a) => a + 1) }}>
              Try again
            </Button>
          </>
        )}
      </div>
    )
  }

  const { options, units, tags } = load.data
  const errorCount = Object.keys(errors).length

  return (
    <form className="recipe-form" onSubmit={onSubmit} noValidate>
      <header className="recipe-form__top">
        <Link to="/recipes" className="recipe-form__cancel">
          Cancel
        </Link>
        <h1 className="recipe-form__title">New recipe</h1>
        <span aria-hidden="true" />
      </header>

      <ErrorSummary count={errorCount} message={banner} />

      <div className="form-field">
        <label htmlFor="recipe-name" className="form-label">
          Recipe name
        </label>
        <input
          id="recipe-name"
          className="text-input"
          placeholder="e.g. Nan's veggie stew"
          value={form.name}
          maxLength={120}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'recipe-name-error' : undefined}
          onChange={(e) => update({ name: e.target.value })}
        />
        <FieldError id="recipe-name-error" message={errors.name} />
      </div>

      <div className="form-row">
        <div className="form-field">
          <span className="form-label" id="serves-label">
            Serves
          </span>
          <Stepper label="Servings" value={form.serves} min={1} max={20} onChange={(serves) => update({ serves })} />
          <FieldError id="serves-error" message={errors.serves} />
        </div>
        <div className="form-field form-field--grow">
          <label htmlFor="recipe-cuisine" className="form-label">
            Cuisine
          </label>
          <select
            id="recipe-cuisine"
            className="text-input"
            value={form.cuisine}
            onChange={(e) => update({ cuisine: e.target.value as Cuisine })}
          >
            {options.cuisines.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <PillGroup
        legend="Meal type"
        options={options.mealTypes}
        labels={MEAL_TYPE_LABELS}
        selected={form.mealTypes}
        onChange={(mealTypes) => update({ mealTypes })}
        error={errors.mealTypes}
        errorId="meal-types-error"
      />
      <PillGroup
        legend="Suitable for"
        options={options.dietaryLabels}
        labels={DIETARY_LABELS}
        selected={form.dietary}
        onChange={(dietary) => update({ dietary })}
        errorId="dietary-error"
      />
      <TagPicker available={tags} selected={form.tags} onChange={(t) => update({ tags: t })} />

      <IngredientEditor
        rows={form.ingredients}
        units={units}
        errors={errors}
        onChange={(ingredients) => update({ ingredients })}
        onAdd={() => update({ ingredients: [...form.ingredients, emptyIngredient()] })}
      />
      <MethodEditor
        steps={form.method}
        errors={errors}
        onChange={(method) => update({ method })}
        onAdd={() => update({ method: [...form.method, emptyStep()] })}
      />

      <Button type="submit" block disabled={saving}>
        {saving ? 'Saving…' : 'Save recipe'}
      </Button>
    </form>
  )
}
