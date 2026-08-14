/**
 * Issue #212 - the Trello cards section must not put a raw internal error string
 * in front of the user, and must not show a destructive alert when the
 * integration is simply unconfigured or the project has no cards.
 *
 * `baker_get_trello_cards` reads the project's local breadcrumbs.json and never
 * talks to Trello, so its failures are all "cannot reach a file on this
 * machine" and each one has a different remedy. Errors cross the Tauri IPC
 * boundary as plain strings, which is why the failure cases below reject with a
 * string rather than an Error.
 *
 * Only `api.ts`, the I/O boundary, is stubbed. The real hooks, the real query
 * and the real presentation all run.
 */

import '@testing-library/jest-dom'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { bakerGetTrelloCards } from '../api'
import { TrelloCardsManager } from './TrelloCardsManager'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  bakerGetTrelloCards: vi.fn()
}))

const getCards = vi.mocked(bakerGetTrelloCards)

const PROJECT_PATH = '/Volumes/Production/2026 Induction'

function renderManager(projectPath: string = PROJECT_PATH) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })

  return render(
    <QueryClientProvider client={client}>
      <TrelloCardsManager projectPath={projectPath} />
    </QueryClientProvider>
  )
}

/** The headline of the error alert - the one line a user is certain to read. */
async function findAlertHeadline() {
  const alert = await screen.findByRole('alert')
  return within(alert).getByRole('heading').textContent ?? ''
}

describe('TrelloCardsManager empty and unconfigured states', () => {
  beforeEach(() => {
    getCards.mockResolvedValue([])
  })

  it('shows the empty state and no alert when the project has no linked cards', async () => {
    renderManager()

    expect(await screen.findByText('No Trello cards added yet')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the empty state without querying when no project folder is selected', async () => {
    renderManager('')

    expect(await screen.findByText('No Trello cards added yet')).toBeInTheDocument()
    expect(getCards).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('TrelloCardsManager failure presentation', () => {
  it('leads with the missing project folder, not the backend string', async () => {
    getCards.mockRejectedValue('Project path does not exist')
    renderManager()

    expect(await findAlertHeadline()).toBe('Project folder not found on this machine')

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/reconnect it/i)
    expect(alert).not.toHaveTextContent('Failed to load Trello cards')
  })

  it('names the breadcrumbs file, not Trello, when the file will not parse', async () => {
    getCards.mockRejectedValue(
      'Failed to parse breadcrumbs file: expected value at line 1 column 1'
    )
    renderManager()

    expect(await findAlertHeadline()).toBe(
      "This project's breadcrumbs file could not be read"
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/not valid JSON/i)
    expect(alert).toHaveTextContent(/Baker/)
  })

  it('gives an unrecognised failure an actionable headline rather than echoing it', async () => {
    // The shape TanStack Query itself produces when a queryFn resolves
    // undefined, which is what an unimplemented Tauri command looks like.
    getCards.mockRejectedValue(
      new Error('["breadcrumbs","trelloCards","/p"] data is undefined')
    )
    renderManager()

    const headline = await findAlertHeadline()
    expect(headline).toBe('Linked Trello cards could not be loaded')
    expect(headline).not.toContain('data is undefined')

    expect(screen.getByRole('alert')).toHaveTextContent(/unaffected in Trello/i)
  })

  it('keeps the raw error reachable for diagnostics', async () => {
    getCards.mockRejectedValue('Failed to read breadcrumbs file: permission denied')
    renderManager()

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Technical Details')).toBeInTheDocument()
    expect(alert).toHaveTextContent('Failed to read breadcrumbs file: permission denied')
  })

  it('refetches when the user retries', async () => {
    getCards.mockRejectedValueOnce('Project path does not exist').mockResolvedValue([])
    renderManager()

    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => {
      expect(screen.getByText('No Trello cards added yet')).toBeInTheDocument()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
