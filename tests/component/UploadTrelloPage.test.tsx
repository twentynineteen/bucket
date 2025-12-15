/**
 * Component Test: UploadTrelloPage
 *
 * Tests for the UploadTrello page component which handles Trello card
 * browsing and breadcrumbs/video info appending functionality.
 */

import UploadTrello from '@pages/UploadTrello'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the useUploadTrello hook
const mockSetSearchTerm = vi.fn()
const mockSetSelectedCard = vi.fn()

vi.mock('@hooks/useUploadTrello', () => ({
  useUploadTrello: vi.fn(() => ({
    selectedCard: null,
    setSelectedCard: mockSetSelectedCard,
    searchTerm: '',
    setSearchTerm: mockSetSearchTerm,
    filteredGrouped: {},
    isBoardLoading: false,
    isCardLoading: false,
    selectedCardDetails: null,
    members: [],
    uploadedVideo: null,
    boardName: 'Test Board',
    mainDescription: '',
    breadcrumbsData: undefined,
    breadcrumbsBlock: '',
    videoInfoData: null,
    videoInfoBlock: null,
    handleAppendBreadcrumbs: vi.fn(),
    handleAppendVideoInfo: vi.fn(),
    handleOpenInTrello: vi.fn(),
    handleCloseDialog: vi.fn()
  }))
}))

vi.mock('@hooks/useBreadcrumb', () => ({
  useBreadcrumb: vi.fn()
}))

// Import after mocks
import { useUploadTrello } from '@hooks/useUploadTrello'

// Helper to render with providers
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('UploadTrelloPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Page Template Structure', () => {
    test('should render with consistent page wrapper structure', () => {
      renderWithProviders(<UploadTrello />)

      // Should have the outer wrapper with overflow handling
      const pageWrapper = document.querySelector(
        '.h-full.w-full.overflow-x-hidden.overflow-y-auto'
      )
      expect(pageWrapper).toBeInTheDocument()
    })

    test('should render page header with title and description', () => {
      renderWithProviders(<UploadTrello />)

      // Should have page title
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/trello/i)

      // Should have page description
      expect(screen.getByText(/browse.*cards/i)).toBeInTheDocument()
    })

    test('should render header with correct styling', () => {
      renderWithProviders(<UploadTrello />)

      // Header should have border-b, bg-card/50, and proper padding
      const header = document.querySelector('.border-b.border-border')
      expect(header).toBeInTheDocument()
    })
  })

  describe('Content Sections', () => {
    test('should render search input', () => {
      renderWithProviders(<UploadTrello />)

      expect(
        screen.getByPlaceholderText(/search cards by name or description/i)
      ).toBeInTheDocument()
    })

    test('should show board name in header', () => {
      renderWithProviders(<UploadTrello />)

      expect(screen.getByText(/test board/i)).toBeInTheDocument()
    })

    test('should show empty state when no cards available', () => {
      renderWithProviders(<UploadTrello />)

      expect(screen.getByText(/no cards available/i)).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    test('should show loading state when board is loading', () => {
      vi.mocked(useUploadTrello).mockReturnValue({
        selectedCard: null,
        setSelectedCard: mockSetSelectedCard,
        searchTerm: '',
        setSearchTerm: mockSetSearchTerm,
        filteredGrouped: {},
        isBoardLoading: true,
        isCardLoading: false,
        selectedCardDetails: null,
        members: [],
        uploadedVideo: null,
        boardName: 'Test Board',
        mainDescription: '',
        breadcrumbsData: undefined,
        breadcrumbsBlock: '',
        videoInfoData: null,
        videoInfoBlock: null,
        handleAppendBreadcrumbs: vi.fn(),
        handleAppendVideoInfo: vi.fn(),
        handleOpenInTrello: vi.fn(),
        handleCloseDialog: vi.fn()
      })

      renderWithProviders(<UploadTrello />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    test('should call setSearchTerm when typing in search input', async () => {
      const user = userEvent.setup()

      renderWithProviders(<UploadTrello />)

      const searchInput = screen.getByPlaceholderText(
        /search cards by name or description/i
      )
      await user.type(searchInput, 'test')

      expect(mockSetSearchTerm).toHaveBeenCalled()
    })

    test('should show no results message when search has no matches', () => {
      vi.mocked(useUploadTrello).mockReturnValue({
        selectedCard: null,
        setSelectedCard: mockSetSelectedCard,
        searchTerm: 'nonexistent',
        setSearchTerm: mockSetSearchTerm,
        filteredGrouped: {},
        isBoardLoading: false,
        isCardLoading: false,
        selectedCardDetails: null,
        members: [],
        uploadedVideo: null,
        boardName: 'Test Board',
        mainDescription: '',
        breadcrumbsData: undefined,
        breadcrumbsBlock: '',
        videoInfoData: null,
        videoInfoBlock: null,
        handleAppendBreadcrumbs: vi.fn(),
        handleAppendVideoInfo: vi.fn(),
        handleOpenInTrello: vi.fn(),
        handleCloseDialog: vi.fn()
      })

      renderWithProviders(<UploadTrello />)

      expect(screen.getByText(/no cards found matching your search/i)).toBeInTheDocument()
    })
  })

  describe('Card List Display', () => {
    test('should display list names when cards are available', () => {
      vi.mocked(useUploadTrello).mockReturnValue({
        selectedCard: null,
        setSelectedCard: mockSetSelectedCard,
        searchTerm: '',
        setSearchTerm: mockSetSearchTerm,
        filteredGrouped: {
          'In Progress': [
            {
              id: 'card-1',
              name: 'Test Card 1',
              desc: 'Description 1',
              idList: 'list-1',
              idBoard: 'board-1',
              idMembers: [],
              labels: [],
              due: null,
              shortUrl: 'https://trello.com/c/card-1'
            }
          ]
        },
        isBoardLoading: false,
        isCardLoading: false,
        selectedCardDetails: null,
        members: [],
        uploadedVideo: null,
        boardName: 'Test Board',
        mainDescription: '',
        breadcrumbsData: undefined,
        breadcrumbsBlock: '',
        videoInfoData: null,
        videoInfoBlock: null,
        handleAppendBreadcrumbs: vi.fn(),
        handleAppendVideoInfo: vi.fn(),
        handleOpenInTrello: vi.fn(),
        handleCloseDialog: vi.fn()
      })

      renderWithProviders(<UploadTrello />)

      // TrelloCardList uses accordion - list name and count are in the trigger button
      // The button contains "In Progress ( 1 )" as separate text nodes
      const accordionButton = screen.getByRole('button', { name: /in progress/i })
      expect(accordionButton).toBeInTheDocument()
    })
  })

  describe('ErrorBoundary', () => {
    test('should be wrapped in ErrorBoundary', () => {
      // The component should render without throwing
      // ErrorBoundary catches any errors
      expect(() => renderWithProviders(<UploadTrello />)).not.toThrow()
    })
  })
})
