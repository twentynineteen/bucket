import { Breadcrumb, SproutUploadResponse } from '@utils/types'
import { create } from 'zustand'

// Global state definition
interface AppState {
  trelloApiKey: string
  setTrelloApiKey: (trelloKey: string) => void
  trelloApiToken: string
  setTrelloApiToken: (trelloToken: string) => void
  trelloBoardId: string
  setTrelloBoardId: (boardId: string) => void
  sproutVideoApiKey: string
  setSproutVideoApiKey: (sproutKey: string) => void
  breadcrumbs: Breadcrumb
  setBreadcrumbs: (breadcrumb: Breadcrumb) => void
  defaultBackgroundFolder: string | null
  setDefaultBackgroundFolder: (path: string | null) => void
  latestSproutUpload: SproutUploadResponse | null
  setLatestSproutUpload: (upload: SproutUploadResponse | null) => void
  ollamaUrl: string
  setOllamaUrl: (url: string) => void
}

// Create the Zustand store
export const useAppStore = create<AppState>((set) => ({
  trelloApiKey: '',
  setTrelloApiKey: (trelloKey) => set({ trelloApiKey: trelloKey }),
  trelloApiToken: '',
  setTrelloApiToken: (trelloToken) => set({ trelloApiToken: trelloToken }),
  trelloBoardId: '',
  setTrelloBoardId: (boardId) => set({ trelloBoardId: boardId }),
  sproutVideoApiKey: '',
  setSproutVideoApiKey: (sproutKey) => set({ sproutVideoApiKey: sproutKey }),
  breadcrumbs: {},
  setBreadcrumbs: (breadcrumb) => set({ breadcrumbs: breadcrumb }),
  defaultBackgroundFolder: null,
  setDefaultBackgroundFolder: (path) => set({ defaultBackgroundFolder: path }),
  latestSproutUpload: null,
  setLatestSproutUpload: (upload) => set({ latestSproutUpload: upload }),
  ollamaUrl: 'http://localhost:11434',
  setOllamaUrl: (url) => set({ ollamaUrl: url })
}))

export const appStore = useAppStore
