/**
 * Store Contract Tests
 *
 * Verifies the shape and behavior of the shared store barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
 */

import { afterEach, describe, expect, it } from 'vitest'

import { appStore, useAppStore, useBreadcrumbStore } from '../index'

describe('Store Barrel Exports - Shape', () => {
  it('exports useAppStore as a function', () => {
    expect(typeof useAppStore).toBe('function')
  })

  it('exports appStore as a function (alias for useAppStore)', () => {
    expect(typeof appStore).toBe('function')
    expect(appStore).toBe(useAppStore)
  })

  it('exports useBreadcrumbStore as a function', () => {
    expect(typeof useBreadcrumbStore).toBe('function')
  })
})

describe('useAppStore - Behavior', () => {
  afterEach(() => {
    // Reset store state after each test to prevent cross-test contamination
    useAppStore.setState({
      trelloApiKey: '',
      trelloApiToken: '',
      trelloBoardId: '',
      sproutVideoApiKey: '',
      breadcrumbs: {},
      defaultBackgroundFolder: null,
      latestSproutUpload: null,
      ollamaUrl: 'http://localhost:11434'
    })
  })

  it('getState() returns object with expected properties', () => {
    const state = useAppStore.getState()

    expect(state).toHaveProperty('trelloApiKey')
    expect(state).toHaveProperty('setTrelloApiKey')
    expect(state).toHaveProperty('trelloApiToken')
    expect(state).toHaveProperty('setTrelloApiToken')
    expect(state).toHaveProperty('sproutVideoApiKey')
    expect(state).toHaveProperty('setSproutVideoApiKey')
    expect(state).toHaveProperty('breadcrumbs')
    expect(state).toHaveProperty('setBreadcrumbs')
    expect(state).toHaveProperty('defaultBackgroundFolder')
    expect(state).toHaveProperty('setDefaultBackgroundFolder')
    expect(state).toHaveProperty('latestSproutUpload')
    expect(state).toHaveProperty('setLatestSproutUpload')
    expect(state).toHaveProperty('ollamaUrl')
    expect(state).toHaveProperty('setOllamaUrl')
  })

  it('setTrelloApiKey updates state correctly', () => {
    useAppStore.getState().setTrelloApiKey('test-key-123')
    expect(useAppStore.getState().trelloApiKey).toBe('test-key-123')
  })

  it('setSproutVideoApiKey updates state correctly', () => {
    useAppStore.getState().setSproutVideoApiKey('sprout-key-456')
    expect(useAppStore.getState().sproutVideoApiKey).toBe('sprout-key-456')
  })

  it('setOllamaUrl updates state correctly', () => {
    useAppStore.getState().setOllamaUrl('http://custom:9999')
    expect(useAppStore.getState().ollamaUrl).toBe('http://custom:9999')
  })

  it('setDefaultBackgroundFolder updates state correctly', () => {
    useAppStore.getState().setDefaultBackgroundFolder('/custom/path')
    expect(useAppStore.getState().defaultBackgroundFolder).toBe('/custom/path')
  })

  it('setBreadcrumbs updates state correctly', () => {
    const breadcrumbData = { projectTitle: 'Test Project' }
    useAppStore.getState().setBreadcrumbs(breadcrumbData)
    expect(useAppStore.getState().breadcrumbs).toEqual(breadcrumbData)
  })

  it('setLatestSproutUpload updates state correctly', () => {
    const upload = { id: '123', embed_code: '<iframe>' }
    useAppStore
      .getState()
      .setLatestSproutUpload(upload as Parameters<typeof useAppStore.getState>['0'])
    expect(useAppStore.getState().latestSproutUpload).toEqual(upload)
  })
})

describe('useBreadcrumbStore - Behavior', () => {
  afterEach(() => {
    // Reset store state after each test
    useBreadcrumbStore.setState({ breadcrumbs: [] })
  })

  it('getState() returns object with breadcrumbs array and setBreadcrumbs', () => {
    const state = useBreadcrumbStore.getState()

    expect(state).toHaveProperty('breadcrumbs')
    expect(state).toHaveProperty('setBreadcrumbs')
    expect(Array.isArray(state.breadcrumbs)).toBe(true)
    expect(typeof state.setBreadcrumbs).toBe('function')
  })

  it('setBreadcrumbs updates state correctly', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Settings' }
    ]
    useBreadcrumbStore.getState().setBreadcrumbs(items)
    expect(useBreadcrumbStore.getState().breadcrumbs).toEqual(items)
  })

  it('starts with empty breadcrumbs array', () => {
    expect(useBreadcrumbStore.getState().breadcrumbs).toEqual([])
  })
})
