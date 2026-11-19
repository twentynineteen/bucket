/**
 * useBreadcrumbsTrelloCards: updating a linked card (#371).
 *
 * Only the two I/O functions the hook calls are mocked, so these cover what it
 * really asks the breadcrumbs module to do and what it does with a refusal.
 */

import { applyBreadcrumbsChange } from '@features/Breadcrumbs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { bakerGetTrelloCards } from '../api'
import { useBreadcrumbsTrelloCards } from './useBreadcrumbsTrelloCards'

vi.mock('@features/Breadcrumbs', () => ({
  applyBreadcrumbsChange: vi.fn()
}))
vi.mock('../api', () => ({
  bakerGetTrelloCards: vi.fn(),
  bakerAssociateTrelloCard: vi.fn(),
  bakerRemoveTrelloCard: vi.fn(),
  bakerFetchTrelloCardDetails: vi.fn()
}))

type ApplyOutcomes = Awaited<ReturnType<typeof applyBreadcrumbsChange>>

const PROJECT = '/Volumes/Share/Demo Project'
const CARD = {
  url: 'https://trello.com/c/5f1e2d3c4b5a69788796a5b4',
  cardId: '5f1e2d3c4b5a69788796a5b4',
  title: 'MOD101 - A Lecturer - Module overview (5:05mins)',
  boardName: 'Small Projects',
  lastFetched: '2026-11-19T14:00:00Z'
}

async function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  const { result } = renderHook(
    () => useBreadcrumbsTrelloCards({ projectPath: PROJECT }),
    { wrapper }
  )
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  return result
}

beforeEach(() => {
  vi.mocked(bakerGetTrelloCards).mockResolvedValue([])
})

describe('useBreadcrumbsTrelloCards update (#371)', () => {
  test('asks for one in-place update of the card, for this project only', async () => {
    vi.mocked(applyBreadcrumbsChange).mockResolvedValue([
      { status: 'applied', project: PROJECT, file: { trelloCards: [CARD] } }
    ] as unknown as ApplyOutcomes)
    const result = await setup()

    await result.current.updateTrelloCardAsync(CARD)

    expect(applyBreadcrumbsChange).toHaveBeenCalledTimes(1)
    expect(applyBreadcrumbsChange).toHaveBeenCalledWith([PROJECT], {
      kind: 'updateTrelloCard',
      card: CARD
    })
  })

  test('rejects with the reason when the backend refuses the change', async () => {
    vi.mocked(applyBreadcrumbsChange).mockResolvedValue([
      {
        status: 'failed',
        project: PROJECT,
        error: { kind: 'cardNotLinked', cardId: CARD.cardId },
        message: `Trello card ${CARD.cardId} is not linked to this project`
      }
    ])
    const result = await setup()

    await expect(result.current.updateTrelloCardAsync(CARD)).rejects.toThrow(
      `Trello card ${CARD.cardId} is not linked to this project`
    )
  })
})
