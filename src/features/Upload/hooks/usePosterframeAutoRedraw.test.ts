/**
 * Tests for usePosterframeAutoRedraw - initial draw, input changes, and the
 * template's place in the redraw trigger (issue #189 B3.7): switching
 * template with the same background file must repaint, or the preview shows
 * the other brand's layout.
 *
 * Moved here from tests/unit/hooks/ per the testing policy (colocated units).
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
    draw.mockResolvedValue(undefined)
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

    await waitFor(() => expect(draw).toHaveBeenCalledWith(IMAGE, TITLE, 'rebrand'))
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

describe('usePosterframeAutoRedraw - initial draw', () => {
  const draw = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    draw.mockClear()
    draw.mockResolvedValue(undefined)
  })

  it('draws the bare background immediately when the title is empty', () => {
    renderHook(
      () =>
        usePosterframeAutoRedraw({
          draw,
          imageUrl: IMAGE,
          title: '',
          templateId: 'classic'
        }),
      { wrapper }
    )

    expect(draw).toHaveBeenCalledWith(IMAGE, '', 'classic')
    expect(draw).toHaveBeenCalledTimes(1)
  })

  it('treats a whitespace title as empty', () => {
    renderHook(
      () =>
        usePosterframeAutoRedraw({
          draw,
          imageUrl: IMAGE,
          title: '   ',
          templateId: 'classic'
        }),
      { wrapper }
    )

    expect(draw).toHaveBeenCalledWith(IMAGE, '', 'classic')
  })

  it('draws nothing without an image', () => {
    renderHook(
      () =>
        usePosterframeAutoRedraw({
          draw,
          imageUrl: null,
          title: TITLE,
          templateId: 'classic'
        }),
      { wrapper }
    )

    expect(draw).not.toHaveBeenCalled()
  })
})

describe('usePosterframeAutoRedraw - input changes', () => {
  const draw = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    draw.mockClear()
    draw.mockResolvedValue(undefined)
  })

  it('stops drawing when the image is cleared', async () => {
    const { rerender } = renderHook(
      (props: { imageUrl: string | null }) =>
        usePosterframeAutoRedraw({
          draw,
          imageUrl: props.imageUrl,
          title: TITLE,
          templateId: 'classic',
          debounceMs: 1
        }),
      { initialProps: { imageUrl: IMAGE as string | null }, wrapper }
    )

    draw.mockClear()
    rerender({ imageUrl: null })

    await waitFor(() => expect(draw).not.toHaveBeenCalled(), { timeout: 200 })
  })

  it('falls back to the bare background when the title is cleared', async () => {
    const { rerender } = renderHook(
      (props: { title: string }) =>
        usePosterframeAutoRedraw({
          draw,
          imageUrl: IMAGE,
          title: props.title,
          templateId: 'classic',
          debounceMs: 1
        }),
      { initialProps: { title: TITLE }, wrapper }
    )

    draw.mockClear()
    rerender({ title: '' })

    await waitFor(() => expect(draw).toHaveBeenCalledWith(IMAGE, '', 'classic'))
  })

  it('survives a rejecting draw', async () => {
    draw.mockRejectedValueOnce(new Error('Canvas draw failed'))

    renderHook(
      () =>
        usePosterframeAutoRedraw({
          draw,
          imageUrl: IMAGE,
          title: '',
          templateId: 'classic'
        }),
      { wrapper }
    )

    await waitFor(() => expect(draw).toHaveBeenCalled())
  })
})
