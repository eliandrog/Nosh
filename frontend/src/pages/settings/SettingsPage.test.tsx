import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../../api/client'
import { api } from '../../api/endpoints'
import type { Profile } from '../../api/types'
import { SettingsPage } from './SettingsPage'

vi.mock('../../api/endpoints', () => ({
  api: { getProfile: vi.fn(), getPreferences: vi.fn(), updateProfile: vi.fn() },
}))
const mocked = vi.mocked(api)

const SAM: Profile = { name: 'Sam Jones', email: 'sam@example.com', householdSize: 2 }

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/settings', element: <SettingsPage /> },
      { path: '/settings/dietary', element: <h1>Dietary preferences page</h1> },
    ],
    { initialEntries: ['/settings'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const row = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) })

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocked.getProfile.mockResolvedValue(SAM)
    mocked.getPreferences.mockResolvedValue({ dietary: ['gluten-free', 'vegetarian'] })
  })

  it('shows the profile, household size and dietary summary, and links to dietary preferences', async () => {
    const user = userEvent.setup()
    const router = renderPage()

    expect(await screen.findByText('SJ')).toBeInTheDocument() // initials avatar
    expect(row('Household size')).toHaveTextContent('2 people')
    const dietary = screen.getByRole('link', { name: /Dietary preferences/ })
    expect(dietary).toHaveTextContent('Vegetarian, Gluten-free') // fixed order, not storage order

    await user.click(dietary)
    expect(router.state.location.pathname).toBe('/settings/dietary')
  })

  it('edits the household size and saves the whole profile', async () => {
    mocked.updateProfile.mockResolvedValue({ ...SAM, householdSize: 4 })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /^Household size/ }))
    const sheet = screen.getByRole('dialog', { name: 'Household size' })
    await user.click(within(sheet).getByRole('button', { name: 'More people' }))
    await user.click(within(sheet).getByRole('button', { name: 'More people' }))
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(mocked.updateProfile).toHaveBeenCalledWith({ name: 'Sam Jones', email: 'sam@example.com', householdSize: 4 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(row('Household size')).toHaveTextContent('4 people')
  })

  it('shows the server validation message under the field and keeps the editor open', async () => {
    mocked.updateProfile.mockRejectedValue(
      new ValidationError(422, {
        code: 'validation_error',
        message: 'Some details need fixing.',
        details: { fields: { email: 'Enter a valid email address.' } },
        requestId: 'r1',
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /^Email/ }))
    const sheet = screen.getByRole('dialog', { name: 'Your email' })
    const input = within(sheet).getByLabelText('Email')
    await user.clear(input)
    await user.type(input, 'not-an-email')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(await within(sheet).findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(mocked.updateProfile).toHaveBeenCalledWith({ name: 'Sam Jones', email: 'not-an-email', householdSize: 2 })
    expect(row('Email')).toHaveTextContent('sam@example.com') // saved value unchanged
  })
})
