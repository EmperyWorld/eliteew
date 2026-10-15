/**
 * Tests for Card component
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card } from '../Card'

describe('Card', () => {
  it('renders children correctly', () => {
    render(
      <Card>
        <div>Card content</div>
      </Card>
    )
    
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies default classes', () => {
    render(<Card>Test Card</Card>)
    const card = screen.getByText('Test Card').parentElement
    expect(card).toHaveClass('glass')
  })

  it('applies custom className', () => {
    render(<Card className="custom-card">Test Card</Card>)
    const card = screen.getByText('Test Card').parentElement
    expect(card).toHaveClass('custom-card')
  })

  it('renders with glass effect by default', () => {
    render(<Card>Glass Card</Card>)
    const card = screen.getByText('Glass Card').parentElement
    expect(card).toHaveClass('glass')
  })

  it('can be used as different element with as prop', () => {
    render(
      <Card as="section">
        <h2>Section Card</h2>
      </Card>
    )
    
    const section = screen.getByRole('heading', { name: /section card/i }).parentElement
    expect(section?.tagName).toBe('SECTION')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<Card ref={ref}>Ref Card</Card>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})
