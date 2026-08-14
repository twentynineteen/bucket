/**
 * AddVideoDialog Tests
 * DEBT-007: Testing refactored component with grouped parameters
 *
 * TDD Phase: RED - These tests expect the new grouped parameter interface
 */

import {
  AddVideoDialog,
  type AddVideoDialogProps,
  type PosterFrameDialogState
} from '../../../src/features/Baker/components/AddVideoDialog'
import { render as baseRender, screen } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, test, vi } from 'vitest'

import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@tests/utils/queryClientWrapper'

/**
 * AddVideoDialog now renders SproutFolderPicker, which reads folder levels
 * through React Query (issue #155). Every render needs a client in scope.
 */
const render = (ui: React.ReactElement, options?: RenderOptions) =>
  baseRender(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
    ),
    ...options
  })


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

// Helper function to create default props
function createDefaultProps(): AddVideoDialogProps {
  return {
    dialog: {
      isOpen: true,
      onOpenChange: vi.fn(),
      canAddVideo: true
    },
    mode: {
      addMode: 'url',
      onTabChange: vi.fn()
    },
    form: {
      formData: {
        url: '',
        title: '',
        thumbnailUrl: '',
        sproutVideoId: ''
      },
      onFormFieldChange: vi.fn()
    },
    urlMode: {
      onFetchDetails: vi.fn(),
      onAddVideo: vi.fn(),
      isFetchingVideo: false,
      hasApiKey: true,
      fetchError: null
    },
    uploadMode: {
      selectedFile: null,
      uploading: false,
      progress: 0,
      message: null,
      uploadSuccess: false,
      onSelectFile: vi.fn(),
      onUploadAndAdd: vi.fn(),
      apiKey: 'test-api-key',
      selectedFolder: null,
      onSelectedFolderChange: vi.fn(),
      recentFolders: []
    },
    errors: {
      validationErrors: [],
      addError: null
    },
    posterFrame: {
      available: true,
      unavailableReason: null,
      enabled: false,
      onEnabledChange: vi.fn(),
      backgrounds: ['/backgrounds/wbs-blue.jpg'],
      selectedBackground: '/backgrounds/wbs-blue.jpg',
      onBackgroundChange: vi.fn(),
      template: 'classic',
      onTemplateChange: vi.fn(),
      offAspect: false,
      text: '',
      onTextChange: vi.fn(),
      previewImageUrl: null,
      saveCopy: false,
      onSaveCopyChange: vi.fn(),
      status: 'idle',
      error: null,
      onRetry: vi.fn()
    },
    posterFrameCanvasRef: React.createRef<HTMLCanvasElement>()
  }
}

describe('AddVideoDialog - Dialog State Group', () => {
  test('renders dialog when isOpen is true', () => {
    const props = createDefaultProps()
    render(<AddVideoDialog {...props} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Add Video Link')).toBeInTheDocument()
  })

  test('calls onOpenChange when dialog is closed', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    render(<AddVideoDialog {...props} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(props.dialog.onOpenChange).toHaveBeenCalledWith(false)
  })

  test('disables add button when canAddVideo is false', () => {
    const props = createDefaultProps()
    props.dialog.canAddVideo = false
    props.dialog.isOpen = false // Render trigger button

    render(<AddVideoDialog {...props} />)

    const addButton = screen.getByRole('button', { name: /add video/i })
    expect(addButton).toBeDisabled()
  })
})

describe('AddVideoDialog - Mode State Group', () => {
  test('renders URL tab by default when addMode is "url"', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'url'

    render(<AddVideoDialog {...props} />)

    expect(screen.getByLabelText(/video url/i)).toBeInTheDocument()
  })

  test('renders Upload tab when addMode is "upload"', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'upload'

    render(<AddVideoDialog {...props} />)

    expect(screen.getByText(/select video file/i)).toBeInTheDocument()
  })

  test('calls onTabChange when switching tabs', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()

    render(<AddVideoDialog {...props} />)

    const uploadTab = screen.getByRole('tab', { name: /upload file/i })
    await user.click(uploadTab)

    expect(props.mode.onTabChange).toHaveBeenCalledWith('upload')
  })
})

describe('AddVideoDialog - Form State Group', () => {
  test('displays form data values correctly', () => {
    const props = createDefaultProps()
    props.form.formData = {
      url: 'https://sproutvideo.com/videos/test123',
      title: 'Test Video',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      sproutVideoId: 'test123'
    }

    render(<AddVideoDialog {...props} />)

    expect(
      screen.getByDisplayValue('https://sproutvideo.com/videos/test123')
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Video')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://example.com/thumb.jpg')).toBeInTheDocument()
    expect(screen.getByDisplayValue('test123')).toBeInTheDocument()
  })

  test('calls onFormFieldChange when URL input changes', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()

    render(<AddVideoDialog {...props} />)

    const urlInput = screen.getByLabelText(/video url/i)
    await user.type(urlInput, 'https://sproutvideo.com/videos/new')

    expect(props.form.onFormFieldChange).toHaveBeenCalledWith('url', expect.any(String))
  })

  test('calls onFormFieldChange when title input changes', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()

    render(<AddVideoDialog {...props} />)

    const titleInput = screen.getByLabelText(/title/i)
    await user.type(titleInput, 'New Title')

    expect(props.form.onFormFieldChange).toHaveBeenCalledWith('title', expect.any(String))
  })
})

describe('AddVideoDialog - URL Mode State Group', () => {
  test('calls onFetchDetails when Fetch Details button is clicked', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.form.formData.url = 'https://sproutvideo.com/videos/test'

    render(<AddVideoDialog {...props} />)

    const fetchButton = screen.getByRole('button', { name: /fetch details/i })
    await user.click(fetchButton)

    expect(props.urlMode.onFetchDetails).toHaveBeenCalled()
  })

  test('shows loading indicator when isFetchingVideo is true', () => {
    const props = createDefaultProps()
    props.urlMode.isFetchingVideo = true
    props.form.formData.url = 'https://sproutvideo.com/videos/test'

    render(<AddVideoDialog {...props} />)

    // When fetching, button should be disabled and show no text (just spinner icon)
    const buttons = screen.getAllByRole('button')
    const fetchButton = buttons.find(
      (btn) => btn.hasAttribute('disabled') && btn.closest('.flex')
    )
    expect(fetchButton).toBeDisabled()
  })

  test('shows API key warning when hasApiKey is false', () => {
    const props = createDefaultProps()
    props.urlMode.hasApiKey = false
    props.form.formData.url = 'https://sproutvideo.com/videos/test'

    render(<AddVideoDialog {...props} />)

    expect(screen.getByText(/api key not configured/i)).toBeInTheDocument()
  })

  test('displays fetch error when fetchError is present', () => {
    const props = createDefaultProps()
    props.urlMode.fetchError = 'Failed to fetch video details'

    render(<AddVideoDialog {...props} />)

    expect(screen.getByText('Failed to fetch video details')).toBeInTheDocument()
  })

  test('calls onAddVideo when Add Video button is clicked', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()

    render(<AddVideoDialog {...props} />)

    const addButton = screen.getByRole('button', { name: /^add video$/i })
    await user.click(addButton)

    expect(props.urlMode.onAddVideo).toHaveBeenCalled()
  })
})

describe('AddVideoDialog - Upload Mode State Group', () => {
  test('displays selected file name when selectedFile is set', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'upload'
    props.uploadMode.selectedFile = '/path/to/video.mp4'

    render(<AddVideoDialog {...props} />)

    expect(screen.getByText(/video\.mp4/i)).toBeInTheDocument()
  })

  test('calls onSelectFile when Select Video File button is clicked', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.mode.addMode = 'upload'

    render(<AddVideoDialog {...props} />)

    const selectButton = screen.getByRole('button', { name: /select video file/i })
    await user.click(selectButton)

    expect(props.uploadMode.onSelectFile).toHaveBeenCalled()
  })

  test('shows upload progress when uploading is true', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'upload'
    props.uploadMode.uploading = true
    props.uploadMode.progress = 45

    render(<AddVideoDialog {...props} />)

    expect(screen.getByText(/uploading: 45%/i)).toBeInTheDocument()
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '45')
  })

  test('disables Upload and Add button when no file is selected', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'upload'
    props.uploadMode.selectedFile = null

    render(<AddVideoDialog {...props} />)

    const uploadButton = screen.getByRole('button', { name: /upload and add/i })
    expect(uploadButton).toBeDisabled()
  })

  test('calls onUploadAndAdd when Upload and Add button is clicked', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.mode.addMode = 'upload'
    props.uploadMode.selectedFile = '/path/to/video.mp4'

    render(<AddVideoDialog {...props} />)

    const uploadButton = screen.getByRole('button', { name: /upload and add/i })
    await user.click(uploadButton)

    expect(props.uploadMode.onUploadAndAdd).toHaveBeenCalled()
  })

  test('shows success message when uploadSuccess is true', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'upload'
    props.uploadMode.uploadSuccess = true

    render(<AddVideoDialog {...props} />)

    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument()
  })

  test('displays upload message when present', () => {
    const props = createDefaultProps()
    props.mode.addMode = 'upload'
    props.uploadMode.message = {
      text: 'Upload completed successfully',
      severity: 'success'
    }

    render(<AddVideoDialog {...props} />)

    expect(screen.getByText('Upload completed successfully')).toBeInTheDocument()
  })
})

describe('AddVideoDialog - Error State Group', () => {
  test('displays validation errors when present', () => {
    const props = createDefaultProps()
    props.errors.validationErrors = [
      'Title is required',
      'URL must be a valid Sprout Video link'
    ]

    render(<AddVideoDialog {...props} />)

    expect(screen.getByText('Title is required')).toBeInTheDocument()
    expect(screen.getByText('URL must be a valid Sprout Video link')).toBeInTheDocument()
  })

  test('displays add error when present', () => {
    const props = createDefaultProps()
    props.errors.addError = new Error('Failed to add video to breadcrumbs')

    render(<AddVideoDialog {...props} />)

    expect(screen.getByText('Failed to add video to breadcrumbs')).toBeInTheDocument()
  })

  test('does not display error alerts when no errors', () => {
    const props = createDefaultProps()
    props.errors.validationErrors = []
    props.errors.addError = null
    props.urlMode.fetchError = null

    render(<AddVideoDialog {...props} />)

    const alerts = screen.queryAllByRole('alert')
    expect(alerts).toHaveLength(0)
  })
})

describe('AddVideoDialog - Integration Tests', () => {
  test('complete URL workflow: enter URL, fetch details, add video', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.form.formData.url = 'https://sproutvideo.com/videos/test123'

    render(<AddVideoDialog {...props} />)

    // Verify URL is populated
    expect(
      screen.getByDisplayValue('https://sproutvideo.com/videos/test123')
    ).toBeInTheDocument()

    // Fetch details
    const fetchButton = screen.getByRole('button', { name: /fetch details/i })
    await user.click(fetchButton)
    expect(props.urlMode.onFetchDetails).toHaveBeenCalled()

    // Add video
    const addButton = screen.getByRole('button', { name: /^add video$/i })
    await user.click(addButton)
    expect(props.urlMode.onAddVideo).toHaveBeenCalled()
  })

  test('complete upload workflow: select file, upload, finish', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()
    props.mode.addMode = 'upload'

    render(<AddVideoDialog {...props} />)

    // Select file
    const selectButton = screen.getByRole('button', { name: /select video file/i })
    await user.click(selectButton)
    expect(props.uploadMode.onSelectFile).toHaveBeenCalled()

    // Simulate file selected
    props.uploadMode.selectedFile = '/path/to/video.mp4'
    render(<AddVideoDialog {...props} />)

    // Upload
    const uploadButton = screen.getByRole('button', { name: /upload and add/i })
    await user.click(uploadButton)
    expect(props.uploadMode.onUploadAndAdd).toHaveBeenCalled()
  })

  test('handles error states gracefully across all groups', () => {
    const props = createDefaultProps()
    props.urlMode.fetchError = 'Network error'
    props.errors.validationErrors = ['Invalid URL format']
    props.errors.addError = new Error('Database error')

    render(<AddVideoDialog {...props} />)

    // All errors should be displayed
    expect(screen.getByText('Network error')).toBeInTheDocument()
    expect(screen.getByText('Invalid URL format')).toBeInTheDocument()
    expect(screen.getByText('Database error')).toBeInTheDocument()
  })
})

// The "Parameter Grouping Benefits" describe block that used to sit here
// contained only export-count assertions (Object.keys(x).toHaveLength) on test
// fixture data. These break on every legitimate type addition and verify no
// production behaviour, so they have been removed per the testing policy.
