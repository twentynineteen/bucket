/**
 * Trello API Layer - Single I/O boundary for the Trello module
 *
 * All external calls (Tauri invoke, Trello REST API, file plugins)
 * are wrapped here. Mock this one file to isolate the entire module.
 */
import { invoke } from '@tauri-apps/api/core'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { ask, confirm, open as openDialog } from '@tauri-apps/plugin-dialog'

import type { TrelloBoard } from '@shared/types'
import type { TrelloCard, TrelloList, TrelloMember } from './types'

import { logger } from '@shared/utils/logger'

// --- Tauri Commands ---

export async function fetchTrelloBoards(
  apiKey: string,
  apiToken: string
): Promise<TrelloBoard[]> {
  return invoke<TrelloBoard[]>('fetch_trello_boards', { apiKey, apiToken })
}

// --- Trello REST API ---

export async function fetchCardWithMembers(
  cardId: string,
  apiKey: string,
  token: string
): Promise<TrelloCard & { members?: TrelloMember[] }> {
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${token}&members=true`
  )
  if (!res.ok) throw new Error('Failed to fetch card')
  return res.json()
}

export async function fetchBoardCards(
  boardId: string,
  apiKey: string,
  token: string
): Promise<TrelloCard[]> {
  const url = `https://api.trello.com/1/boards/${boardId}/cards?key=${apiKey}&token=${token}`
  try {
    const response = await fetch(url)
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }
    return response.json()
  } catch (error) {
    logger.error('Error fetching Trello cards:', error)
    throw error
  }
}

export async function fetchBoardLists(
  boardId: string,
  apiKey: string,
  token: string
): Promise<TrelloList[]> {
  const url = `https://api.trello.com/1/boards/${boardId}/lists?key=${apiKey}&token=${token}`
  try {
    const response = await fetch(url)
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }
    return response.json()
  } catch (error) {
    logger.error('Error fetching Trello lists:', error)
    throw error
  }
}

export async function fetchCardMembers(
  cardId: string,
  apiKey: string,
  token: string
): Promise<TrelloMember[]> {
  const url = `https://api.trello.com/1/cards/${cardId}/members?key=${apiKey}&token=${token}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

export async function updateTrelloCard(
  cardId: string,
  updates: Partial<{ name: string; desc: string }>,
  apiKey: string,
  token: string
): Promise<void> {
  const url = `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${token}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update Trello card: ${error}`)
  }
}

export async function fetchTrelloCardById(
  cardId: string,
  apiKey: string,
  token: string
): Promise<TrelloCard> {
  const response = await fetch(
    `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${token}`,
    { method: 'GET' }
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch card: ${response.statusText}`)
  }
  return response.json()
}

export async function addCardComment(
  cardId: string,
  text: string,
  apiKey: string,
  token: string
): Promise<void> {
  const commentResponse = await fetch(
    `https://api.trello.com/1/cards/${cardId}/actions/comments?key=${apiKey}&token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }
  )
  if (!commentResponse.ok) {
    logger.warn(`Failed to add comment: ${commentResponse.statusText}`)
  }
}

// --- File System ---

export async function readBreadcrumbsFile(path: string): Promise<string> {
  return readTextFile(path)
}

export async function writeBreadcrumbsFile(path: string, content: string): Promise<void> {
  await writeTextFile(path, content)
}

// --- Baker Tauri Commands (Trello card data in breadcrumbs) ---

export async function bakerGetTrelloCards(projectPath: string): Promise<unknown[]> {
  return invoke('baker_get_trello_cards', { projectPath })
}

export async function bakerAssociateTrelloCard(
  projectPath: string,
  trelloCard: unknown
): Promise<unknown> {
  return invoke('baker_associate_trello_card', { projectPath, trelloCard })
}

export async function bakerRemoveTrelloCard(
  projectPath: string,
  cardIndex: number
): Promise<unknown> {
  return invoke('baker_remove_trello_card', { projectPath, cardIndex })
}

export async function bakerFetchTrelloCardDetails(
  cardUrl: string,
  apiKey: string,
  apiToken: string
): Promise<unknown> {
  return invoke('baker_fetch_trello_card_details', {
    cardUrl,
    apiKey,
    apiToken
  })
}

export async function bakerReadBreadcrumbs(projectPath: string): Promise<unknown> {
  return invoke('baker_read_breadcrumbs', { projectPath })
}

// --- Dialog Wrappers ---

export async function askDialog(
  message: string,
  options: {
    title: string
    okLabel: string
    cancelLabel: string
  }
): Promise<boolean> {
  return ask(message, options)
}

export async function confirmDialog(
  message: string,
  options: {
    title: string
    okLabel: string
    cancelLabel: string
  }
): Promise<boolean> {
  return confirm(message, options)
}

export async function openFileDialog(options: {
  multiple: boolean
  filters: Array<{ name: string; extensions: string[] }>
}): Promise<string | null> {
  const selectedFile = await openDialog(options)
  if (typeof selectedFile === 'string') {
    return selectedFile
  }
  return null
}
