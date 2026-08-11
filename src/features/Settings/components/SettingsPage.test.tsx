/**
 * Tests for SettingsPage - reporting a settings file that cannot be read.
 * Issue #166 (B8.3-B8.5)
 *
 * loadApiKeys used to swallow read failures and resolve {}, so an unreadable
 * api_keys.json rendered every section as never-configured. Now that it
 * rethrows, the page has to say so, and it must stop sections from saving over
 * a file whose contents are merely unparseable rather than lost.
 */

import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsPage from './SettingsPage'
import * as api from '../api'

vi.mock('../api', () => ({
  loadSettingsApiKeys: vi.fn(),
  openFolderPicker: vi.fn(),
  saveSettingsApiKeys: vi.fn(),
  directoryExists: vi.fn().mockResolvedValue(true)
}))

vi.mock('@shared/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/hooks')>()
  return { ...actual, useBreadcrumb: vi.fn() }
})

vi.mock('../hooks/useSettingsScroll', () => ({ useSettingsScroll: vi.fn() }))

/** Each section is stubbed so we can read the props the page hands it. */
const sectionProps: Record<string, Record<string, unknown>> = {}

function stubSection(name: string) {
  return {
    default: (props: Record<string, unknown>) => {
      sectionProps[name] = props
      return <div data-testid={`section-${name}`} />
    }
  }
}

vi.mock('./AIModelsSection', () => stubSection('ai-models'))
vi.mock('./AppearanceSection', () => stubSection('appearance'))
vi.mock('./BackgroundsSection', () => stubSection('backgrounds'))
vi.mock('./SproutVideoSection', () => stubSection('sprout'))
vi.mock('./TrelloSection', () => stubSection('trello'))

const SECTIONS = ['ai-models', 'appearance', 'backgrounds', 'sprout', 'trello']
/** Sections that receive api keys and can write them back. */
const SAVING_SECTIONS = ['ai-models', 'backgrounds', 'sprout', 'trello']

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>
  )
}

describe('SettingsPage - settings read failure (#166)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(sectionProps)) delete sectionProps[key]
  })

  it('b8_3_shows_a_banner_and_still_renders_every_section', async () => {
    vi.mocked(api.loadSettingsApiKeys).mockRejectedValue(new Error('unparseable'))

    renderPage()

    // The 'settings' retry strategy deliberately retries a read/parse failure
    // once after 500ms (query-utils.ts:179-184), so the banner is legitimately
    // slower than the 1s default wait.
    expect(
      await screen.findByText(/could not read your saved settings/i, undefined, {
        timeout: 5000
      })
    ).toBeInTheDocument()
    for (const name of SECTIONS) {
      expect(screen.getByTestId(`section-${name}`)).toBeInTheDocument()
    }
  })

  it('b8_4_tells_every_saving_section_that_settings_are_unavailable', async () => {
    vi.mocked(api.loadSettingsApiKeys).mockRejectedValue(new Error('unparseable'))

    renderPage()

    await screen.findByText(/could not read your saved settings/i, undefined, {
      timeout: 5000
    })
    for (const name of SAVING_SECTIONS) {
      expect(sectionProps[name]).toMatchObject({ settingsUnavailable: true })
    }
  })

  it('b8_5_shows_no_banner_and_leaves_saving_enabled_on_a_successful_read', async () => {
    vi.mocked(api.loadSettingsApiKeys).mockResolvedValue({
      defaultBackgroundFolder: '/backgrounds'
    })

    renderPage()

    await screen.findByTestId('section-backgrounds')
    expect(
      screen.queryByText(/could not read your saved settings/i)
    ).not.toBeInTheDocument()
    for (const name of SAVING_SECTIONS) {
      expect(sectionProps[name]).toMatchObject({ settingsUnavailable: false })
    }
  })
})
