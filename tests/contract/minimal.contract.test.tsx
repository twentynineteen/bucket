import { queryKeys } from '@lib/query-keys'
import { renderWithQueryClient } from '@tests/utils/query-test-utils'
import React from 'react'

describe('Minimal Contract Test', () => {
  it('should use renderWithQueryClient utility', () => {
    const SimpleComponent = () => React.createElement('div', null, 'Test')
    const { queryClient } = renderWithQueryClient(React.createElement(SimpleComponent))

    expect(queryClient).toBeDefined()
  })

  it('should access query keys', () => {
    const queryKey = queryKeys.user.breadcrumb()
    expect(queryKey).toEqual(['user', 'breadcrumb'])
  })
})
