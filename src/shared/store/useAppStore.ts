import { Breadcrumb, RecentSproutFolder, SproutUploadResponse } from '@shared/types'
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
  /** Backgrounds for the Rebrand posterframe template (issue #189). The
   * Classic template keeps the original defaultBackgroundFolder key. */
  rebrandBackgroundFolder: string | null
  setRebrandBackgroundFolder: (path: string | null) => void
  /**
   * The posterframe template chosen this session (issue #189). Held here, not
   * in each hook instance: the AddVideo dialog and the card poster frame
   * dialog mount the choice twice in one tree and must agree live. Kept as a
   * raw string - the template registry lives in the Upload feature, and
   * shared/ never imports features. null means "no choice made yet"; the
   * durable copy is localStorage, owned by usePosterframeTemplate.
   */
  posterframeTemplateChoice: string | null
  setPosterframeTemplateChoice: (template: string | null) => void
  latestSproutUpload: SproutUploadResponse | null
  setLatestSproutUpload: (upload: SproutUploadResponse | null) => void
  ollamaUrl: string
  setOllamaUrl: (url: string) => void
  /**
   * Folders used this session, most recent first (issue #155). Session-scoped
   * on purpose: the durable answer is the default in Settings, and this store
   * has no persistence. Capped at RECENT_SPROUT_FOLDER_LIMIT.
   */
  recentSproutFolders: RecentSproutFolder[]
  rememberSproutFolder: (folder: RecentSproutFolder | null) => void
}

/** How many recent folders to keep. Enough to cover a working set, short
 * enough that the list stays scannable above the tree. */
export const RECENT_SPROUT_FOLDER_LIMIT = 5

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
  rebrandBackgroundFolder: null,
  setRebrandBackgroundFolder: (path) => set({ rebrandBackgroundFolder: path }),
  posterframeTemplateChoice: null,
  setPosterframeTemplateChoice: (template) =>
    set({ posterframeTemplateChoice: template }),
  latestSproutUpload: null,
  setLatestSproutUpload: (upload) => set({ latestSproutUpload: upload }),
  ollamaUrl: 'http://localhost:11434',
  setOllamaUrl: (url) => set({ ollamaUrl: url }),
  recentSproutFolders: [],
  rememberSproutFolder: (folder) =>
    set((state) => {
      // Root is the default, not a destination worth remembering.
      if (!folder) return state
      const withoutDuplicate = state.recentSproutFolders.filter(
        (existing) => existing.id !== folder.id
      )
      return {
        recentSproutFolders: [folder, ...withoutDuplicate].slice(
          0,
          RECENT_SPROUT_FOLDER_LIMIT
        )
      }
    })
}))

export const appStore = useAppStore
