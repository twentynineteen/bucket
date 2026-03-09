/**
 * AITools API Layer - Single I/O boundary for the AITools module
 *
 * All external calls (Tauri invoke, plugins, fetch, services)
 * are wrapped here. Mock this one file to isolate the entire module.
 */

import { invoke } from '@tauri-apps/api/core'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import {
  mkdir,
  readFile,
  readTextFile,
  writeFile,
  writeTextFile
} from '@tauri-apps/plugin-fs'
import { ModelFactory } from '@shared/services/ai/modelFactory'
import { providerRegistry } from '@shared/services/ai/providerConfig'

import type {
  ExampleWithMetadata,
  OllamaTagsResponse,
  ProviderConfiguration,
  ReplaceRequest,
  SimilarExample,
  UploadRequest
} from './types'

// --- Embedding Commands ---

export async function getAllExamples(): Promise<ExampleWithMetadata[]> {
  return invoke<ExampleWithMetadata[]>('get_all_examples_with_metadata')
}

export async function uploadExample(request: UploadRequest): Promise<string> {
  return invoke<string>('upload_example', { request })
}

export async function replaceExample(id: string, request: ReplaceRequest): Promise<void> {
  return invoke<void>('replace_example', { id, request })
}

export async function deleteExample(id: string): Promise<void> {
  return invoke<void>('delete_example', { id })
}

// --- RAG Search ---

export async function searchSimilarScripts(
  queryEmbedding: number[],
  topK: number,
  minSimilarity: number
): Promise<SimilarExample[]> {
  return invoke<SimilarExample[]>('search_similar_scripts', {
    queryEmbedding,
    topK,
    minSimilarity
  })
}

// --- File Dialog ---

export async function openScriptFileDialog(): Promise<string | null> {
  const result = await openDialog({
    multiple: false,
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  })
  return typeof result === 'string' ? result : null
}

export async function openDocxFileDialog(): Promise<string | null> {
  const result = await openDialog({
    multiple: false,
    filters: [{ name: 'Word Documents', extensions: ['docx'] }]
  })
  return typeof result === 'string' ? result : null
}

export async function exportExampleDialog(defaultName: string): Promise<string | null> {
  return saveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'Folder', extensions: [''] }]
  })
}

export async function saveDocxDialog(defaultFilename: string): Promise<string | null> {
  return saveDialog({
    defaultPath: defaultFilename,
    filters: [{ name: 'Word Document', extensions: ['docx'] }]
  })
}

// --- File System ---

export async function readScriptFile(path: string): Promise<string> {
  return readTextFile(path)
}

export async function writeDocxFile(path: string, data: Uint8Array): Promise<void> {
  return writeFile(path, data)
}

export async function readDocxFile(path: string): Promise<Uint8Array> {
  return readFile(path)
}

export async function createDirectory(path: string): Promise<void> {
  return mkdir(path, { recursive: true })
}

export async function writeTextToFile(path: string, content: string): Promise<void> {
  return writeTextFile(path, content)
}

// --- Ollama Embedding ---

export async function checkOllamaModels(baseUrl: string): Promise<OllamaTagsResponse> {
  const response = await fetch(`${baseUrl}/api/tags`, {
    signal: AbortSignal.timeout(5000)
  })
  if (!response.ok) throw new Error('Ollama is not running')
  return response.json()
}

export async function generateOllamaEmbedding(
  baseUrl: string,
  model: string,
  text: string
): Promise<number[]> {
  const response = await fetch(`${baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text }),
    signal: AbortSignal.timeout(30000)
  })
  if (!response.ok) throw new Error(`Ollama API error: ${response.status}`)
  const data = await response.json()
  return data.embedding
}

// --- AI Model ---

export function createAIModel(config: {
  providerId: string
  modelId: string
  configuration: ProviderConfiguration
}) {
  return ModelFactory.createModel(config)
}

export function listAIProviders() {
  return providerRegistry.list()
}

export function getAIProvider(id: string) {
  return providerRegistry.get(id)
}
