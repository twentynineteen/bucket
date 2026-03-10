// Components
/** Button to open the Trello integration modal from project views */
export { default as TrelloIntegrationButton } from './components/TrelloIntegrationButton'
/** Modal for linking Trello cards to a project with board selection and search */
export { default as TrelloIntegrationModal } from './components/TrelloIntegrationModal'
/** Manager component for displaying and editing linked Trello cards on a project */
export { TrelloCardsManager } from './components/TrelloCardsManager'
/** Single Trello card display with title, labels, and action buttons */
export { TrelloCardItem } from './components/TrelloCardItem'
/** Dialog for updating an existing Trello card link on a project */
export { TrelloCardUpdateDialog } from './components/TrelloCardUpdateDialog'
/** Dropdown selector for choosing a Trello board from available boards */
export { TrelloBoardSelector } from './components/TrelloBoardSelector'
/** Error display component for Trello board loading failures */
export { TrelloBoardError } from './components/TrelloBoardError'
/** Dialog showing full details of a Trello card including description and members */
export { CardDetailsDialog } from './components/CardDetailsDialog'
/** Dialog for adding a new Trello card link to a project */
export { AddCardDialog } from './components/AddCardDialog'
/** Page for uploading video links to Trello card descriptions */
export { default as UploadTrello } from './components/UploadTrello'

// Hooks
/** Hook for fetching all available Trello boards for the authenticated user */
export { useTrelloBoards } from './hooks/useTrelloBoards'
/** Hook for fetching cards and lists from a specific Trello board */
export { useTrelloBoard } from './hooks/useTrelloBoard'
/** Hook for managing the selected Trello board ID with persistence */
export { useTrelloBoardId } from './hooks/useTrelloBoardId'
/** Hook for searching cards within a Trello board by name */
export { useTrelloBoardSearch } from './hooks/useTrelloBoardSearch'
/** Hook for fetching detailed information about a specific Trello card */
export { useTrelloCardDetails } from './hooks/useTrelloCardDetails'
/** Hook for managing card selection state in the Trello integration modal */
export { useTrelloCardSelection } from './hooks/useTrelloCardSelection'
/** Hook for CRUD operations on Trello cards linked to a project */
export { useTrelloCardsManager } from './hooks/useTrelloCardsManager'
/** Hook for Trello card mutation actions -- add, update, remove, reorder */
export { useTrelloActions } from './hooks/useTrelloActions'
/** Hook for reading and writing Trello card data in project breadcrumbs */
export { useTrelloBreadcrumbs } from './hooks/useTrelloBreadcrumbs'
/** Hook for the UploadTrello page workflow -- card URL input and video embed */
export { useUploadTrello } from './hooks/useUploadTrello'
/** Hook for fetching video metadata from a Trello card's linked Sprout videos */
export { useTrelloVideoInfo } from './hooks/useTrelloVideoInfo'
/** Hook for parsing Trello card descriptions to extract video and metadata fields */
export { useParsedTrelloDescription } from './hooks/useParsedTrelloDescription'
/** Hook for Baker-to-Trello integration -- syncing breadcrumbs with Trello cards */
export { useBakerTrelloIntegration } from './hooks/useBakerTrelloIntegration'
/** Hook for managing the video links array on a Trello card */
export { useVideoLinksManager } from './hooks/useVideoLinksManager'
/** Hook for reading Trello card references from project breadcrumbs files */
export { useBreadcrumbsTrelloCards } from './hooks/useBreadcrumbsTrelloCards'

// Types (re-export for consumers)
/** Trello card data with id, name, labels, and board membership */
export type { TrelloCard } from './types'
/** Trello list data with id, name, and position */
export type { TrelloList } from './types'
/** Trello board member with id, username, and avatar */
export type { TrelloMember } from './types'
/** Selected card state for the integration modal -- card data plus selection metadata */
export type { SelectedCard } from './types'
/** State shape for the UploadTrello page workflow */
export type { UploadTrelloState } from './types'
/** Factory function returning a default empty SproutUploadResponse */
export { createDefaultSproutUploadResponse } from './types'
