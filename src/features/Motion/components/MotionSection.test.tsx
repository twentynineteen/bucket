/**
 * MotionSection tests (issue #333)
 *
 * Covers behaviours L5.1 - L5.6: section structure, folder picker,
 * clear folder, format combobox, error state, and import graph safety.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { pickFolder, readMotionPrefsText, writeMotionPrefsText } from '../api'
import MotionSection from './MotionSection'

// Mock the api module (I/O boundary)
vi.mock('../api', () => ({
  readMotionPrefsText: vi.fn(),
  writeMotionPrefsText: vi.fn(),
  pickFolder: vi.fn()
}))

const mockedRead = vi.mocked(readMotionPrefsText)
const mockedWrite = vi.mocked(writeMotionPrefsText)
const mockedPick = vi.mocked(pickFolder)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function renderSection() {
  const Wrapper = createWrapper()
  return render(
    <Wrapper>
      <MotionSection />
    </Wrapper>
  )
}

// ---------------------------------------------------------------------------
// L5.1 - Section structure
// ---------------------------------------------------------------------------
describe('L5.1 MotionSection structure', () => {
  it('has id="motion", heading "Motion", library folder field and default format', async () => {
    mockedRead.mockResolvedValue(null)
    renderSection()

    await waitFor(() => {
      const section = document.getElementById('motion')
      expect(section).toBeTruthy()
    })

    expect(screen.getByRole('heading', { name: /motion/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /choose library folder/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /default format/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// L5.2 - Choose library folder
// ---------------------------------------------------------------------------
describe('L5.2 MotionSection choose library folder', () => {
  it('shows the chosen path and saves it', async () => {
    mockedRead.mockResolvedValue(null)
    mockedWrite.mockResolvedValue(undefined)
    mockedPick.mockResolvedValue('/Users/e/motion')

    renderSection()

    // Wait for the query to settle (button becomes enabled)
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /choose library folder/i })
      expect(btn).toBeEnabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /choose library folder/i }))

    // The click triggers pickFolder -> updatePrefs -> write.
    await waitFor(
      () => {
        expect(mockedWrite).toHaveBeenCalled()
      },
      { timeout: 3000 }
    )

    const written = JSON.parse(mockedWrite.mock.calls[0][0])
    expect(written.libraryFolder).toBe('/Users/e/motion')

    await waitFor(() => {
      expect(screen.getByText('/Users/e/motion')).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// L5.3 - Clear library folder
// ---------------------------------------------------------------------------
describe('L5.3 MotionSection clear library folder', () => {
  it('clears the folder and saves', async () => {
    mockedRead.mockResolvedValue(JSON.stringify({ libraryFolder: '/Users/e/motion' }))
    mockedWrite.mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderSection()

    await waitFor(() => {
      expect(screen.getByText('/Users/e/motion')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /clear library folder/i }))

    await waitFor(() => {
      expect(mockedWrite).toHaveBeenCalled()
    })
    const written = JSON.parse(
      mockedWrite.mock.calls[mockedWrite.mock.calls.length - 1][0]
    )
    expect(written.libraryFolder).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// L5.4 - Default format combobox
// ---------------------------------------------------------------------------
describe('L5.4 MotionSection default format', () => {
  it('shows 3840x2160 @ 50 by default and lists all expected options', async () => {
    mockedRead.mockResolvedValue(null)
    const user = userEvent.setup()
    renderSection()

    await waitFor(() => {
      expect(screen.getByText(/3840.*2160.*50/)).toBeInTheDocument()
    })

    // Open the select
    const trigger = screen.getByRole('combobox', { name: /default format/i })
    await user.click(trigger)

    // Check presence of key options (not a count - per testing policy)
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /3840.*2160.*24/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /3840.*2160.*25/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /3840.*2160.*30/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /3840.*2160.*50/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /3840.*2160.*60/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /1920.*1080.*24/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /1920.*1080.*25/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /1920.*1080.*30/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /1920.*1080.*50/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /1920.*1080.*60/ })).toBeInTheDocument()
    })
  })

  it('saves the chosen format', async () => {
    mockedRead.mockResolvedValue(null)
    mockedWrite.mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderSection()

    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: /default format/i })
      ).toBeInTheDocument()
    })

    const trigger = screen.getByRole('combobox', { name: /default format/i })
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /1920.*1080.*25/ })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('option', { name: /1920.*1080.*25/ }))

    await waitFor(() => {
      expect(mockedWrite).toHaveBeenCalled()
    })
    const written = JSON.parse(
      mockedWrite.mock.calls[mockedWrite.mock.calls.length - 1][0]
    )
    expect(written.defaultFormat.width).toBe(1920)
    expect(written.defaultFormat.height).toBe(1080)
    expect(written.defaultFormat.fps).toBe(25)
  })
})

// ---------------------------------------------------------------------------
// L5.5 - Error state
// ---------------------------------------------------------------------------
describe('L5.5 MotionSection error state', () => {
  it('shows error message when prefs cannot be read', async () => {
    mockedRead.mockRejectedValue(new Error('disk failure'))
    renderSection()

    await waitFor(() => {
      expect(screen.getByText(/motion settings could not be loaded/i)).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// L5.6 - Import graph does not reach builtins
// ---------------------------------------------------------------------------
describe('L5.6 MotionSection does not import builtins', () => {
  it('has no transitive import to internal/builtins.ts or internal/templates/', () => {
    const sectionPath = path.resolve(__dirname, 'MotionSection.tsx')
    // Walk static imports transitively
    const visited = new Set<string>()
    const queue = [sectionPath]
    const importRe = /from\s+['"]([^'"]+)['"]/g

    while (queue.length > 0) {
      const file = queue.pop()!
      if (visited.has(file)) continue
      visited.add(file)

      let src: string
      try {
        src = fs.readFileSync(file, 'utf-8')
      } catch {
        continue
      }

      let match: RegExpExecArray | null
      while ((match = importRe.exec(src)) !== null) {
        const specifier = match[1]
        if (!specifier.startsWith('.')) continue
        const dir = path.dirname(file)
        // Try .ts, .tsx, /index.ts, /index.tsx extensions
        for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
          const candidate = path.resolve(dir, specifier + ext)
          if (fs.existsSync(candidate)) {
            queue.push(candidate)
            break
          }
        }
      }
    }

    const visitedPaths = [...visited].map(p => p.replace(/\\/g, '/'))
    const reachesBuiltins = visitedPaths.some(
      p => p.includes('internal/builtins') || p.includes('internal/templates/')
    )
    expect(reachesBuiltins).toBe(false)
  })
})
