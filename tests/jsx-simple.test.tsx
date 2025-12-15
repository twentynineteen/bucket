import { render } from '@testing-library/react'
import React from 'react'

describe('Simple JSX Test', () => {
  it('should render JSX', () => {
    const { container } = render(<div>Hello World</div>)
    expect(container.textContent).toBe('Hello World')
  })
})
