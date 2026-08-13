/**
 * Tests for usePosterframeTemplate - the remembered Classic/Rebrand choice
 * shared by the Posterframe page and the upload dialog.
 * Issue #189 (B3.4, B3.5)
 */

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAppStore } from '@shared/store'

import { POSTERFRAME_TEMPLATE_STORAGE_KEY } from '../internal/posterframeTemplates'
import { usePosterframeTemplate } from './usePosterframeTemplate'

describe('usePosterframeTemplate (#189)', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({
      defaultBackgroundFolder: '/backgrounds/classic',
      rebrandBackgroundFolder: null
    })
  })

  it('b3_5_starts_on_classic_while_no_rebrand_folder_is_configured', () => {
    const { result } = renderHook(() => usePosterframeTemplate())

    expect(result.current.template).toBe('classic')
  })

  it('b3_5_starts_on_rebrand_once_its_folder_is_configured', () => {
    useAppStore.setState({ rebrandBackgroundFolder: '/backgrounds/rebrand' })

    const { result } = renderHook(() => usePosterframeTemplate())

    expect(result.current.template).toBe('rebrand')
  })

  it('b3_4_persists_the_choice_under_the_shared_key', () => {
    useAppStore.setState({ rebrandBackgroundFolder: '/backgrounds/rebrand' })
    const { result } = renderHook(() => usePosterframeTemplate())

    act(() => {
      result.current.setTemplate('classic')
    })

    expect(result.current.template).toBe('classic')
    expect(localStorage.getItem(POSTERFRAME_TEMPLATE_STORAGE_KEY)).toBe('classic')
  })

  it('b3_4_a_second_surface_starts_on_the_stored_choice', () => {
    useAppStore.setState({ rebrandBackgroundFolder: '/backgrounds/rebrand' })
    const first = renderHook(() => usePosterframeTemplate())
    act(() => {
      first.result.current.setTemplate('classic')
    })

    // A separate mount - the other surface - must pick the same template up.
    const second = renderHook(() => usePosterframeTemplate())

    expect(second.result.current.template).toBe('classic')
  })

  it('b3_4_an_explicit_choice_beats_the_configured_default', () => {
    localStorage.setItem(POSTERFRAME_TEMPLATE_STORAGE_KEY, 'rebrand')

    // Rebrand folder NOT configured - the stored choice still wins, and the
    // folder hook reports not-configured rather than silently switching.
    const { result } = renderHook(() => usePosterframeTemplate())

    expect(result.current.template).toBe('rebrand')
  })
})
