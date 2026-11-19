/**
 * useScriptProcessor against a real AI SDK stream.
 *
 * The model is the SDK's own mock, so streamText runs for real: prompt
 * validation, streaming and text collection all happen as they do against
 * Ollama. AI SDK 7 rejects system messages inside `messages`, which no
 * type check caught - only running the call does.
 */

import type { LanguageModelV4StreamPart } from '@ai-sdk/provider'
import { act, renderHook } from '@testing-library/react'
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAIModel, searchSimilarScripts } from '../../api'
import { useScriptProcessor } from './useScriptProcessor'

vi.mock('../../api', () => ({
  createAIModel: vi.fn(),
  searchSimilarScripts: vi.fn()
}))

vi.mock('./useOllamaEmbedding', () => ({
  useOllamaEmbedding: () => ({
    embed: async () => [0.1, 0.2],
    isReady: true,
    isLoading: false,
    error: null
  })
}))

function streamingModel(text: string[]) {
  const chunks: LanguageModelV4StreamPart[] = [
    ...text.map(delta => ({ type: 'text-delta' as const, id: 'text-1', delta })),
    {
      type: 'finish',
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 20, text: 20, reasoning: 0 }
      }
    }
  ]
  return new MockLanguageModelV4({
    doStream: async () => ({ stream: simulateReadableStream({ chunks }) })
  })
}

describe('useScriptProcessor', () => {
  beforeEach(() => {
    vi.mocked(searchSimilarScripts).mockResolvedValue([])
  })

  it('formats a script through streamText and sends the system prompt as instructions', async () => {
    const model = streamingModel(['Formatted ', 'script'])
    vi.mocked(createAIModel).mockReturnValue(model)

    const { result } = renderHook(() => useScriptProcessor())

    let output: Awaited<ReturnType<typeof result.current.processScript>> | undefined
    await act(async () => {
      output = await result.current.processScript({
        text: 'Original script',
        modelId: 'llama3',
        providerId: 'ollama',
        configuration: {
          serviceUrl: 'http://localhost:11434',
          connectionStatus: 'configured'
        }
      })
    })

    expect(output?.formattedText).toBe('Formatted script')
    // The system prompt reaches the model as a system message, and the
    // script travels in the single user message.
    const prompt = model.doStreamCalls[0].prompt
    expect(prompt[0].role).toBe('system')
    expect(prompt.filter(message => message.role === 'user')).toHaveLength(1)
  })
})
