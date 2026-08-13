/**
 * Tests for usePosterframeAutoRedraw - the template must be part of the
 * redraw trigger, or switching template with the same background file leaves
 * a stale preview on screen.
 * Issue #189 (B3.7)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePosterframeAutoRedraw } from './usePosterframeAutoRedraw'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })
  return React.createElement(QueryClientProvider, { client: queryClient }, children)
}

const IMAGE = 'blob:background'
const TITLE = 'Managing Change'

describe('usePosterframeAutoRedraw - template in the redraw key (#189)', () => {
  const draw = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    draw.mockClear()
  })

  it('b3_7_passes_the_template_through_to_draw', async () => {
    renderHook(
      () =>
        usePosterframeAutoRedraw({
          draw,
          imageUrl: IMAGE,
          title: TITLE,
          templateId: 'rebrand',
          debounceMs: 1
        }),
      { wrapper }
    )

    await waitFor(() =>
      expect(draw).toHaveBeenCalledWith(IMAGE, TITLE, 'rebrand')
    )
  })

  it('b3_7_redraws_when_only_the_template_changes', async () => {
    const { rerender } = renderHook(
      (props: { templateId: 'classic' | 'rebrand' }) =>
        usePosterframeAutoRedraw({
          draw,
          imageUrl: IMAGE,
          title: TITLE,
          templateId: props.templateId,
          debounceMs: 1
        }),
      { initialProps: { templateId: 'classic' as 'classic' | 'rebrand' }, wrapper }
    )

    await waitFor(() => expect(draw).toHaveBeenCalledWith(IMAGE, TITLE, 'classic'))
    draw.mockClear()

    // Same image, same title - only the template differs. The preview must
    // repaint, because the two templates lay the text out differently.
    rerender({ templateId: 'rebrand' })

    await waitFor(() => expect(draw).toHaveBeenCalledWith(IMAGE, TITLE, 'rebrand'))
  })
})
