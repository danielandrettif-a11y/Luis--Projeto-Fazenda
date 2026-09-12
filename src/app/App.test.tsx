import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import { App } from './App'

test('shows the product name', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Gestão da Fazenda' })).toBeInTheDocument()
})
