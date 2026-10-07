import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SearchBar } from './SearchBar'

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <SearchBar value={value} onChange={setValue} label="Search recipes" placeholder="Search recipes or ingredients" />
}

describe('SearchBar', () => {
  it('is a labelled search field that shows a clear button only when there is text', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const input = screen.getByRole('searchbox', { name: 'Search recipes' })
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()

    await user.type(input, 'dahl')
    expect(input).toHaveValue('dahl')

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(input).toHaveValue('')
    expect(input).toHaveFocus() // focus returns to the field so the user can keep typing
  })

  it('clears with Escape', async () => {
    const user = userEvent.setup()
    render(<Harness initial="soup" />)
    const input = screen.getByRole('searchbox', { name: 'Search recipes' })

    await user.type(input, '{Escape}')
    expect(input).toHaveValue('')
  })
})
