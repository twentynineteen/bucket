/**
 * Tests for storage utility - API keys persistence
 * DEBT-014: Add Trello board ID configuration
 *
 * TDD Phase: RED (Writing failing tests first)
 */

import { appStore } from '@/store/useAppStore'
import { ApiKeys, loadApiKeys, saveApiKeys } from '@/utils/storage'
import * as tauriPath from '@tauri-apps/api/path'
import * as tauriFs from '@tauri-apps/plugin-fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn()
}))

// Mock app store
vi.mock('@/store/useAppStore', () => ({
  appStore: {
    getState: vi.fn(() => ({
      setSproutVideoApiKey: vi.fn(),
      setTrelloApiKey: vi.fn(),
      setTrelloApiToken: vi.fn(),
      setTrelloBoardId: vi.fn(), // NEW: For DEBT-014
      setDefaultBackgroundFolder: vi.fn(),
      setOllamaUrl: vi.fn()
    }))
  }
}))

describe('storage utility', () => {
  const mockAppDataDir = '/mock/app/data/dir/'
  const mockFilePath = `${mockAppDataDir}api_keys.json`

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(tauriPath.appDataDir).mockResolvedValue(mockAppDataDir)
  })

  describe('ApiKeys interface', () => {
    it('should support trelloBoardId field', () => {
      // Test that TypeScript accepts trelloBoardId
      const apiKeys: ApiKeys = {
        sproutVideo: 'test-sprout-key',
        trello: 'test-trello-key',
        trelloToken: 'test-trello-token',
        trelloBoardId: '55a504d70bed2bd21008dc5a', // NEW FIELD
        defaultBackgroundFolder: '/test/folder',
        ollamaUrl: 'http://localhost:11434'
      }

      expect(apiKeys.trelloBoardId).toBe('55a504d70bed2bd21008dc5a')
    })

    it('should allow trelloBoardId to be optional', () => {
      const apiKeys: ApiKeys = {
        trello: 'test-key'
      }

      expect(apiKeys.trelloBoardId).toBeUndefined()
    })
  })

  describe('saveApiKeys', () => {
    it('should save trelloBoardId to file', async () => {
      const apiKeys: ApiKeys = {
        trello: 'test-key',
        trelloToken: 'test-token',
        trelloBoardId: '55a504d70bed2bd21008dc5a'
      }

      await saveApiKeys(apiKeys)

      expect(tauriFs.writeTextFile).toHaveBeenCalledWith(
        mockFilePath,
        expect.stringContaining('"trelloBoardId": "55a504d70bed2bd21008dc5a"')
      )
    })

    it('should update app store with trelloBoardId', async () => {
      const mockSetTrelloBoardId = vi.fn()
      vi.mocked(appStore.getState).mockReturnValue({
        setSproutVideoApiKey: vi.fn(),
        setTrelloApiKey: vi.fn(),
        setTrelloApiToken: vi.fn(),
        setTrelloBoardId: mockSetTrelloBoardId,
        setDefaultBackgroundFolder: vi.fn(),
        setOllamaUrl: vi.fn()
      } as any)

      const apiKeys: ApiKeys = {
        trelloBoardId: 'custom-board-id-123'
      }

      await saveApiKeys(apiKeys)

      expect(mockSetTrelloBoardId).toHaveBeenCalledWith('custom-board-id-123')
    })

    it('should handle undefined trelloBoardId gracefully', async () => {
      const apiKeys: ApiKeys = {
        trello: 'test-key',
        trelloToken: 'test-token'
        // No trelloBoardId
      }

      await expect(saveApiKeys(apiKeys)).resolves.not.toThrow()
    })

    it('should handle null trelloBoardId gracefully', async () => {
      const apiKeys: ApiKeys = {
        trello: 'test-key',
        trelloToken: 'test-token',
        trelloBoardId: undefined
      }

      await expect(saveApiKeys(apiKeys)).resolves.not.toThrow()
    })

    it('should save all API keys including trelloBoardId', async () => {
      const apiKeys: ApiKeys = {
        sproutVideo: 'sprout-key',
        trello: 'trello-key',
        trelloToken: 'trello-token',
        trelloBoardId: 'board-id-123',
        defaultBackgroundFolder: '/backgrounds',
        ollamaUrl: 'http://localhost:11434'
      }

      await saveApiKeys(apiKeys)

      const expectedJson = JSON.stringify(apiKeys, null, 2)
      expect(tauriFs.writeTextFile).toHaveBeenCalledWith(mockFilePath, expectedJson)
    })
  })

  describe('loadApiKeys', () => {
    it('should load trelloBoardId from file', async () => {
      const savedData: ApiKeys = {
        trello: 'test-key',
        trelloToken: 'test-token',
        trelloBoardId: '55a504d70bed2bd21008dc5a'
      }

      vi.mocked(tauriFs.exists).mockResolvedValue(true)
      vi.mocked(tauriFs.readTextFile).mockResolvedValue(JSON.stringify(savedData))

      const result = await loadApiKeys()

      expect(result.trelloBoardId).toBe('55a504d70bed2bd21008dc5a')
    })

    it('should update app store with loaded trelloBoardId', async () => {
      const mockSetTrelloBoardId = vi.fn()
      vi.mocked(appStore.getState).mockReturnValue({
        setSproutVideoApiKey: vi.fn(),
        setTrelloApiKey: vi.fn(),
        setTrelloApiToken: vi.fn(),
        setTrelloBoardId: mockSetTrelloBoardId,
        setDefaultBackgroundFolder: vi.fn(),
        setOllamaUrl: vi.fn()
      } as any)

      const savedData: ApiKeys = {
        trelloBoardId: 'loaded-board-id-456'
      }

      vi.mocked(tauriFs.exists).mockResolvedValue(true)
      vi.mocked(tauriFs.readTextFile).mockResolvedValue(JSON.stringify(savedData))

      await loadApiKeys()

      expect(mockSetTrelloBoardId).toHaveBeenCalledWith('loaded-board-id-456')
    })

    it('should return empty object when trelloBoardId is not saved', async () => {
      const savedData: ApiKeys = {
        trello: 'test-key',
        trelloToken: 'test-token'
        // No trelloBoardId
      }

      vi.mocked(tauriFs.exists).mockResolvedValue(true)
      vi.mocked(tauriFs.readTextFile).mockResolvedValue(JSON.stringify(savedData))

      const result = await loadApiKeys()

      expect(result.trelloBoardId).toBeUndefined()
    })

    it('should return empty object when file does not exist', async () => {
      vi.mocked(tauriFs.exists).mockResolvedValue(false)

      const result = await loadApiKeys()

      expect(result).toEqual({})
      expect(result.trelloBoardId).toBeUndefined()
    })

    it('should handle file read errors gracefully', async () => {
      vi.mocked(tauriFs.exists).mockResolvedValue(true)
      vi.mocked(tauriFs.readTextFile).mockRejectedValue(new Error('Read error'))

      const result = await loadApiKeys()

      expect(result).toEqual({})
    })

    it('should handle malformed JSON gracefully', async () => {
      vi.mocked(tauriFs.exists).mockResolvedValue(true)
      vi.mocked(tauriFs.readTextFile).mockResolvedValue('invalid json {')

      const result = await loadApiKeys()

      expect(result).toEqual({})
    })
  })

  describe('integration scenarios', () => {
    it('should persist trelloBoardId across save and load cycle', async () => {
      const originalData: ApiKeys = {
        trello: 'key',
        trelloToken: 'token',
        trelloBoardId: 'persistent-board-id'
      }

      // Save
      await saveApiKeys(originalData)
      const savedJson = vi.mocked(tauriFs.writeTextFile).mock.calls[0][1] as string

      // Mock load
      vi.mocked(tauriFs.exists).mockResolvedValue(true)
      vi.mocked(tauriFs.readTextFile).mockResolvedValue(savedJson)

      // Load
      const loadedData = await loadApiKeys()

      expect(loadedData.trelloBoardId).toBe('persistent-board-id')
    })

    it('should not lose existing keys when adding trelloBoardId', async () => {
      const existingData: ApiKeys = {
        sproutVideo: 'sprout-key',
        trello: 'trello-key',
        trelloToken: 'trello-token',
        defaultBackgroundFolder: '/backgrounds'
      }

      const updatedData: ApiKeys = {
        ...existingData,
        trelloBoardId: 'new-board-id'
      }

      await saveApiKeys(updatedData)

      const savedJson = vi.mocked(tauriFs.writeTextFile).mock.calls[0][1] as string
      const parsed = JSON.parse(savedJson)

      expect(parsed).toEqual(updatedData)
      expect(parsed.sproutVideo).toBe('sprout-key')
      expect(parsed.trelloBoardId).toBe('new-board-id')
    })
  })

  describe('validation', () => {
    it('should accept valid Trello board ID format (24 hex characters)', async () => {
      const validBoardId = '55a504d70bed2bd21008dc5a' // 24 hex chars
      const apiKeys: ApiKeys = {
        trelloBoardId: validBoardId
      }

      await expect(saveApiKeys(apiKeys)).resolves.not.toThrow()
    })

    it('should accept board IDs of different formats', async () => {
      const boardIds = [
        '55a504d70bed2bd21008dc5a', // Standard 24-char hex
        'abcdef1234567890abcdef12', // Another 24-char hex
        'ABCDEF1234567890ABCDEF12', // Uppercase
        'short', // Short ID (for flexibility)
        '123' // Numeric string
      ]

      for (const boardId of boardIds) {
        const apiKeys: ApiKeys = { trelloBoardId: boardId }
        await expect(saveApiKeys(apiKeys)).resolves.not.toThrow()
      }
    })

    it('should accept empty string as board ID', async () => {
      const apiKeys: ApiKeys = {
        trelloBoardId: ''
      }

      await expect(saveApiKeys(apiKeys)).resolves.not.toThrow()
    })
  })
})
