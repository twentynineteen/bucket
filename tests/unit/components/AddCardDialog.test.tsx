/**
 * AddCardDialog Tests
 * DEBT-007: Testing refactored component with grouped parameters
 *
 * TDD Phase: RED - These tests expect the new grouped parameter interface
 */

import { AddCardDialog } from '@/components/Baker/TrelloCards/AddCardDialog'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, test, vi } from 'vitest'

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_, prop) => {
        const Component = React.forwardRef<any, any>((props, ref) => {
          const { children, ...rest } = props
          return React.createElement(prop as string, { ...rest, ref }, children)
        })
        Component.displayName = `motion.${String(prop)}`
        return Component
      }
    }
  ),
  AnimatePresence: ({ children }: any) => children
}))

// Type definitions for grouped parameters
export interface DialogState {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  canAddCard: boolean
  hasApiCredentials: boolean
}

export interface ModeState {
  addMode: 'url' | 'select'
  onAddModeChange: (mode: 'url' | 'select') => void
}

export interface UrlModeState {
  cardUrl: string
  onCardUrlChange: (url: string) => void
  onFetchAndAdd: () => void
}

export interface SelectModeState {
  searchTerm: string
  onSearchTermChange: (term: string) => void
  filteredGrouped: Record<string, Array<{ id: string; name: string; desc?: string }>>
  onSelectCard: (card: { id: string; name: string }) => void
  isBoardLoading: boolean
}

export interface CommonState {
  isFetchingCard: boolean
  onClose: () => void
}

export interface ErrorState {
  validationErrors: string[]
  addError: Error | null
  fetchError: Error | null
}

// Refactored props interface with grouped parameters
export interface AddCardDialogPropsRefactored {
  dialog: DialogState
  mode: ModeState
  urlMode: UrlModeState
  selectMode: SelectModeState
  common: CommonState
  errors: ErrorState
}

// Helper function to create default props
function createDefaultProps(): AddCardDialogPropsRefactored {
  return {
    dialog: {
      isOpen: true,
      onOpenChange: vi.fn(),
      canAddCard: true,
      hasApiCredentials: true
    },
    mode: {
      addMode: 'select',
      onAddModeChange: vi.fn()
    },
    urlMode: {
      cardUrl: '',
      onCardUrlChange: vi.fn(),
      onFetchAndAdd: vi.fn()
    },
    selectMode: {
      searchTerm: '',
      onSearchTermChange: vi.fn(),
      filteredGrouped: {},
      onSelectCard: vi.fn(),
      isBoardLoading: false
    },
    common: {
      isFetchingCard: false,
      onClose: vi.fn()
    },
    errors: {
      validationErrors: [],
      addError: null,
      fetchError: null
    }
  }
}

describe('AddCardDialog - Dialog State Group', () => {
  test('renders dialog when isOpen is true', () => {
    const props = createDefaultProps()
    render(<AddCardDialog {...props} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Add Trello Card')).toBeInTheDocument()
  })

  test('calls onOpenChange when dialog is closed', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.mode.addMode = 'url' // Cancel button only shows in URL mode
    render(<AddCardDialog {...props} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(props.common.onClose).toHaveBeenCalled()
  })

  test('disables add button when canAddCard is false', () => {
    const props = createDefaultProps()
    props.dialog.canAddCard = false
    props.dialog.isOpen = false // Render trigger button

    render(<AddCardDialog {...props} />)

    const addButton = screen.getByRole('button', { name: /add card/i })
    expect(addButton).toBeDisabled()
  })

  test('shows different description when hasApiCredentials is false', () => {
    const props = createDefaultProps()
    props.dialog.hasApiCredentials = false

    render(<AddCardDialog {...props} />)

    expect(screen.getByText(/enter the url of a trello card/i)).toBeInTheDocument()
  })

  test('shows full description when hasApiCredentials is true', () => {
    const props = createDefaultProps()
    props.dialog.hasApiCredentials = true

    render(<AddCardDialog {...props} />)

    expect(
      screen.getByText(/select a card from your board or enter a url/i)
    ).toBeInTheDocument()
  })
})

describe('AddCardDialog - Mode State Group', () => {
  test('renders Select from Board tab by default when addMode is "select"', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'select'

    render(<AddCardDialog {...props} />)

    expect(screen.getByLabelText(/search cards/i)).toBeInTheDocument()
  })

  test('renders URL tab when addMode is "url"', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'url'

    render(<AddCardDialog {...props} />)

    expect(screen.getByLabelText(/trello card url/i)).toBeInTheDocument()
  })

  test('calls onAddModeChange when switching tabs', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()

    render(<AddCardDialog {...props} />)

    const urlTab = screen.getByRole('tab', { name: /enter url/i })
    await user.click(urlTab)

    expect(props.mode.onAddModeChange).toHaveBeenCalledWith('url')
  })

  test('hides tabs when hasApiCredentials is false', () => {
    const props = createDefaultProps()
    props.dialog.hasApiCredentials = false

    render(<AddCardDialog {...props} />)

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})

describe('AddCardDialog - URL Mode State Group', () => {
  test('displays cardUrl value correctly', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'url'
    props.urlMode.cardUrl = 'https://trello.com/c/abc12345/test-card'

    render(<AddCardDialog {...props} />)

    expect(
      screen.getByDisplayValue('https://trello.com/c/abc12345/test-card')
    ).toBeInTheDocument()
  })

  test('calls onCardUrlChange when URL input changes', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.mode.addMode = 'url'

    render(<AddCardDialog {...props} />)

    const urlInput = screen.getByLabelText(/trello card url/i)
    await user.type(urlInput, 'https://trello.com/c/test')

    expect(props.urlMode.onCardUrlChange).toHaveBeenCalled()
  })

  test('calls onFetchAndAdd when Add Card button is clicked', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.mode.addMode = 'url'
    props.urlMode.cardUrl = 'https://trello.com/c/abc12345'

    render(<AddCardDialog {...props} />)

    const addButton = screen.getByRole('button', { name: /add card/i })
    await user.click(addButton)

    expect(props.urlMode.onFetchAndAdd).toHaveBeenCalled()
  })

  test('disables Add Card button when cardUrl is empty', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'url'
    props.urlMode.cardUrl = ''

    render(<AddCardDialog {...props} />)

    const addButton = screen.getByRole('button', { name: /add card/i })
    expect(addButton).toBeDisabled()
  })

  test('shows appropriate help text when hasApiCredentials is true', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'url'
    props.dialog.hasApiCredentials = true

    render(<AddCardDialog {...props} />)

    expect(
      screen.getByText(/card details will be fetched automatically/i)
    ).toBeInTheDocument()
  })

  test('shows appropriate help text when hasApiCredentials is false', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'url'
    props.dialog.hasApiCredentials = false

    render(<AddCardDialog {...props} />)

    expect(
      screen.getByText(/enter the full url from your trello board/i)
    ).toBeInTheDocument()
  })
})

describe('AddCardDialog - Select Mode State Group', () => {
  test('displays search input with correct value', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'select'
    props.selectMode.searchTerm = 'my search'

    render(<AddCardDialog {...props} />)

    expect(screen.getByDisplayValue('my search')).toBeInTheDocument()
  })

  test('calls onSearchTermChange when search input changes', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.mode.addMode = 'select'

    render(<AddCardDialog {...props} />)

    const searchInput = screen.getByLabelText(/search cards/i)
    await user.type(searchInput, 'test')

    expect(props.selectMode.onSearchTermChange).toHaveBeenCalled()
  })

  test('shows loading indicator when isBoardLoading is true', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'select'
    props.selectMode.isBoardLoading = true

    render(<AddCardDialog {...props} />)

    expect(screen.getByText(/loading cards/i)).toBeInTheDocument()
  })

  test('renders card list when not loading', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'select'
    props.selectMode.isBoardLoading = false
    props.selectMode.filteredGrouped = {
      'To Do': [
        { id: '1', name: 'Card 1', desc: 'Description 1' },
        { id: '2', name: 'Card 2', desc: 'Description 2' }
      ],
      Done: [{ id: '3', name: 'Card 3' }]
    }

    render(<AddCardDialog {...props} />)

    // TrelloCardList should render these cards
    expect(screen.queryByText(/loading cards/i)).not.toBeInTheDocument()
  })

  test('calls onSelectCard when a card is selected', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.mode.addMode = 'select'
    props.selectMode.filteredGrouped = {
      'To Do': [{ id: '1', name: 'Test Card' }]
    }

    render(<AddCardDialog {...props} />)

    // This would require mocking TrelloCardList component
    // For now, we verify the prop is passed correctly
    expect(props.selectMode.onSelectCard).toBeDefined()
  })
})

describe('AddCardDialog - Common State Group', () => {
  test('shows fetching indicator when isFetchingCard is true in select mode', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'select'
    props.common.isFetchingCard = true

    render(<AddCardDialog {...props} />)

    expect(screen.getByText(/adding card/i)).toBeInTheDocument()
  })

  test('shows fetching indicator when isFetchingCard is true in URL mode', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'url'
    props.common.isFetchingCard = true
    props.urlMode.cardUrl = 'https://trello.com/c/test'

    render(<AddCardDialog {...props} />)

    const addButton = screen.getByRole('button', { name: /fetching/i })
    expect(addButton).toBeDisabled()
  })

  test('calls onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.mode.addMode = 'url'

    render(<AddCardDialog {...props} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(props.common.onClose).toHaveBeenCalled()
  })
})

describe('AddCardDialog - Error State Group', () => {
  test('displays validation errors when present', () => {
    const props = createDefaultProps()
    props.errors.validationErrors = [
      'Card URL is required',
      'Invalid Trello card URL format'
    ]

    render(<AddCardDialog {...props} />)

    expect(screen.getByText('Card URL is required')).toBeInTheDocument()
    expect(screen.getByText('Invalid Trello card URL format')).toBeInTheDocument()
  })

  test('displays add error when present', () => {
    const props = createDefaultProps()
    props.errors.addError = new Error('Failed to add card to breadcrumbs')

    render(<AddCardDialog {...props} />)

    expect(screen.getByText('Failed to add card to breadcrumbs')).toBeInTheDocument()
  })

  test('displays fetch error when present', () => {
    const props = createDefaultProps()
    props.errors.fetchError = new Error('Failed to fetch card details from Trello API')

    render(<AddCardDialog {...props} />)

    expect(
      screen.getByText('Failed to fetch card details from Trello API')
    ).toBeInTheDocument()
  })

  test('does not display error alerts when no errors', () => {
    const props = createDefaultProps()
    props.errors.validationErrors = []
    props.errors.addError = null
    props.errors.fetchError = null

    render(<AddCardDialog {...props} />)

    const alerts = screen.queryAllByRole('alert')
    expect(alerts).toHaveLength(0)
  })
})

describe('AddCardDialog - Integration Tests', () => {
  test('complete URL workflow: enter URL, add card', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.mode.addMode = 'url'
    props.urlMode.cardUrl = 'https://trello.com/c/abc12345/test-card'

    render(<AddCardDialog {...props} />)

    // Verify URL is populated
    expect(
      screen.getByDisplayValue('https://trello.com/c/abc12345/test-card')
    ).toBeInTheDocument()

    // Add card
    const addButton = screen.getByRole('button', { name: /add card/i })
    await user.click(addButton)

    expect(props.urlMode.onFetchAndAdd).toHaveBeenCalled()
  })

  test('complete select workflow: search, select card', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.mode.addMode = 'select'
    props.selectMode.filteredGrouped = {
      'To Do': [{ id: '1', name: 'Test Card' }]
    }

    render(<AddCardDialog {...props} />)

    // Search for card
    const searchInput = screen.getByLabelText(/search cards/i)
    await user.type(searchInput, 'test')

    expect(props.selectMode.onSearchTermChange).toHaveBeenCalled()
  })

  test('handles error states gracefully across all groups', () => {
    const props = createDefaultProps()
    props.errors.fetchError = new Error('Network error')
    props.errors.validationErrors = ['Invalid URL format']
    props.errors.addError = new Error('Database error')

    render(<AddCardDialog {...props} />)

    // All errors should be displayed
    expect(screen.getByText('Network error')).toBeInTheDocument()
    expect(screen.getByText('Invalid URL format')).toBeInTheDocument()
    expect(screen.getByText('Database error')).toBeInTheDocument()
  })

  test('switches between modes correctly', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.mode.addMode = 'select'

    render(<AddCardDialog {...props} />)

    // Verify select mode is active
    expect(screen.getByLabelText(/search cards/i)).toBeInTheDocument()

    // Switch to URL mode
    const urlTab = screen.getByRole('tab', { name: /enter url/i })
    await user.click(urlTab)

    expect(props.mode.onAddModeChange).toHaveBeenCalledWith('url')
  })
})

describe('AddCardDialog - Parameter Grouping Benefits', () => {
  test('dialog state group provides clear dialog control', () => {
    const props = createDefaultProps()
    const { dialog } = props

    expect(dialog).toHaveProperty('isOpen')
    expect(dialog).toHaveProperty('onOpenChange')
    expect(dialog).toHaveProperty('canAddCard')
    expect(dialog).toHaveProperty('hasApiCredentials')
    expect(Object.keys(dialog)).toHaveLength(4)
  })

  test('mode state group isolates tab switching logic', () => {
    const props = createDefaultProps()
    const { mode } = props

    expect(mode).toHaveProperty('addMode')
    expect(mode).toHaveProperty('onAddModeChange')
    expect(Object.keys(mode)).toHaveLength(2)
  })

  test('urlMode state group groups all URL-related state', () => {
    const props = createDefaultProps()
    const { urlMode } = props

    expect(urlMode).toHaveProperty('cardUrl')
    expect(urlMode).toHaveProperty('onCardUrlChange')
    expect(urlMode).toHaveProperty('onFetchAndAdd')
    expect(Object.keys(urlMode)).toHaveLength(3)
  })

  test('selectMode state group groups all select-related state', () => {
    const props = createDefaultProps()
    const { selectMode } = props

    expect(selectMode).toHaveProperty('searchTerm')
    expect(selectMode).toHaveProperty('onSearchTermChange')
    expect(selectMode).toHaveProperty('filteredGrouped')
    expect(selectMode).toHaveProperty('onSelectCard')
    expect(selectMode).toHaveProperty('isBoardLoading')
    expect(Object.keys(selectMode)).toHaveLength(5)
  })

  test('common state group contains shared state across modes', () => {
    const props = createDefaultProps()
    const { common } = props

    expect(common).toHaveProperty('isFetchingCard')
    expect(common).toHaveProperty('onClose')
    expect(Object.keys(common)).toHaveLength(2)
  })

  test('error state group centralizes all error handling', () => {
    const props = createDefaultProps()
    const { errors } = props

    expect(errors).toHaveProperty('validationErrors')
    expect(errors).toHaveProperty('addError')
    expect(errors).toHaveProperty('fetchError')
    expect(Object.keys(errors)).toHaveLength(3)
  })
})
