/**
 * Test Suite: ScanResults Component
 *
 * The strip above the Baker workspace. While a scan runs it shows live
 * progress. Afterwards it reads as one sentence, for example
 * "14 projects · 6 need attention · 2.8 TB in total · 1,482 folders scanned in 5m 0s",
 * with "N scan errors" appended when there are any. Which projects "need
 * attention" is decided by `needsAttention` in internal/projectStatus.ts.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { ProjectFolder, ScanError, ScanResult } from '../types'
import { ScanResults } from './ScanResults'

const project = (overrides: Partial<ProjectFolder> = {}): ProjectFolder => ({
  path: '/projects/project',
  name: 'Project',
  isValid: true,
  hasBreadcrumbs: true,
  staleBreadcrumbs: false,
  invalidBreadcrumbs: false,
  lastScanned: '2024-01-01T00:00:00Z',
  cameraCount: 1,
  validationErrors: [],
  ...overrides
})

// Two healthy projects, one with a broken structure and no breadcrumbs, and one
// whose breadcrumbs file cannot be parsed: two need attention.
const mockProjects: ProjectFolder[] = [
  project({ path: '/projects/project1', name: 'Project 1', cameraCount: 3 }),
  project({ path: '/projects/project2', name: 'Project 2', cameraCount: 2 }),
  project({
    path: '/projects/project3',
    name: 'Project 3',
    isValid: false,
    hasBreadcrumbs: false,
    cameraCount: 0,
    validationErrors: ['Missing Footage folder']
  }),
  project({
    path: '/projects/project4',
    name: 'Project 4',
    invalidBreadcrumbs: true
  })
]

const scanError = (path: string): ScanError => ({
  path,
  type: 'permission',
  message: 'Permission denied',
  timestamp: '2024-01-01T00:01:00Z'
})

const mockScanResult: ScanResult = {
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-01-01T00:05:00Z',
  rootPath: '/projects',
  totalFolders: 100,
  validProjects: 3,
  updatedBreadcrumbs: 1,
  createdBreadcrumbs: 2,
  totalFolderSize: 5368709120, // 5 GB
  errors: [scanError('/projects/error1'), scanError('/projects/error2')],
  projects: mockProjects
}

const renderSummary = (
  scanResult: ScanResult,
  onShowAttention?: () => void
): ReturnType<typeof render> =>
  render(
    <ScanResults
      scanResult={scanResult}
      isScanning={false}
      scanStartTime={null}
      onShowAttention={onShowAttention}
    />
  )

const summaryText = (container: HTMLElement) =>
  (container.textContent ?? '')
    .replace(/\s*·\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim()

describe('ScanResults Component', () => {
  describe('Rendering states', () => {
    test('returns null when there is no scan result', () => {
      const { container } = render(
        <ScanResults scanResult={null} isScanning={false} scanStartTime={null} />
      )

      expect(container.firstChild).toBeNull()
    })

    test('shows live progress while scanning, not the summary sentence', () => {
      render(
        <ScanResults
          scanResult={mockScanResult}
          isScanning={true}
          scanStartTime={Date.now()}
        />
      )

      expect(screen.getByText('Scanning…')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('folders')).toBeInTheDocument()
      expect(screen.getByText('Projects:')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Elapsed:')).toBeInTheDocument()
      expect(screen.queryByText(/need attention/)).not.toBeInTheDocument()
    })

    test('shows a spinner while scanning', () => {
      const { container } = render(
        <ScanResults
          scanResult={mockScanResult}
          isScanning={true}
          scanStartTime={Date.now()}
        />
      )

      expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    })

    test('updates the progress counts from the partial result', () => {
      render(
        <ScanResults
          scanResult={{ ...mockScanResult, totalFolders: 50, validProjects: 2 }}
          isScanning={true}
          scanStartTime={Date.now()}
        />
      )

      expect(screen.getByText('50')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  describe('Summary sentence', () => {
    test('reads as one sentence with a count, attention, size, coverage and errors', () => {
      const { container } = renderSummary(mockScanResult)

      expect(summaryText(container)).toBe(
        '4 projects · 2 need attention · 5 GB in total · 100 folders scanned in 5m 0s · 2 scan errors'
      )
      expect(screen.queryByText('Scanning…')).not.toBeInTheDocument()
    })

    test('formats a large folder count with a thousands separator', () => {
      const { container } = renderSummary({
        ...mockScanResult,
        totalFolders: 1482,
        errors: []
      })

      expect(summaryText(container)).toContain('1,482 folders scanned')
    })

    test('formats the total size with the shared file size formatter', () => {
      const { container } = renderSummary({
        ...mockScanResult,
        totalFolderSize: 3 * 1024 ** 4,
        errors: []
      })

      expect(summaryText(container)).toContain('3 TB in total')
    })

    test('uses singular wording for one project, one folder and one error', () => {
      const { container } = renderSummary({
        ...mockScanResult,
        totalFolders: 1,
        projects: [project({ invalidBreadcrumbs: true })],
        errors: [scanError('/projects/error1')]
      })

      expect(summaryText(container)).toBe(
        '1 project · 1 needs attention · 5 GB in total · 1 folder scanned in 5m 0s · 1 scan error'
      )
    })

    test('says how long the scan took in seconds when it ran under a minute', () => {
      const { container } = renderSummary({
        ...mockScanResult,
        endTime: '2024-01-01T00:00:42Z'
      })

      expect(summaryText(container)).toContain('100 folders scanned in 42s')
    })

    test('leaves out the duration when the scan has no end time', () => {
      const { container } = renderSummary({ ...mockScanResult, endTime: undefined })

      expect(summaryText(container)).toContain('100 folders scanned ·')
      expect(summaryText(container)).not.toContain(' in 0s')
      expect(screen.queryByText(/scanned in/)).not.toBeInTheDocument()
    })
  })

  describe('Attention count', () => {
    test('counts every project the shared needsAttention rule flags', () => {
      // Adds a stale-breadcrumbs project to the two from mockProjects, and a
      // project that is only structurally invalid but has current breadcrumbs.
      const { container } = renderSummary({
        ...mockScanResult,
        errors: [],
        projects: [
          ...mockProjects,
          project({ path: '/projects/stale', name: 'Stale', staleBreadcrumbs: true }),
          project({ path: '/projects/bad-structure', name: 'Bad', isValid: false })
        ]
      })

      expect(summaryText(container)).toContain('6 projects · 4 need attention')
    })

    test('says "All up to date" in the success colour when nothing needs attention', () => {
      const { container } = renderSummary({
        ...mockScanResult,
        errors: [],
        projects: [mockProjects[0], mockProjects[1]]
      })

      const upToDate = screen.getByText('All up to date')
      expect(upToDate).toHaveClass('text-success')
      expect(screen.queryByText(/need attention|needs attention/)).not.toBeInTheDocument()
      expect(summaryText(container)).toContain('2 projects · All up to date')
    })

    test('is plain text when no onShowAttention handler is passed', () => {
      renderSummary(mockScanResult)

      expect(screen.getByText('2 need attention')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /need attention/ })
      ).not.toBeInTheDocument()
    })

    test('is a button that calls onShowAttention when a handler is passed', async () => {
      const user = userEvent.setup()
      const onShowAttention = vi.fn()
      renderSummary(mockScanResult, onShowAttention)

      await user.click(screen.getByRole('button', { name: '2 need attention' }))

      expect(onShowAttention).toHaveBeenCalledTimes(1)
    })

    test('"All up to date" is never a button, even with a handler', () => {
      renderSummary(
        { ...mockScanResult, errors: [], projects: [mockProjects[0]] },
        vi.fn()
      )

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('Scan errors', () => {
    test('shows the error count in the destructive colour', () => {
      renderSummary(mockScanResult)

      expect(screen.getByText('2 scan errors')).toHaveClass('text-destructive')
    })

    test('leaves out the errors section when there are none', () => {
      renderSummary({ ...mockScanResult, errors: [] })

      expect(screen.queryByText(/scan error/)).not.toBeInTheDocument()
    })
  })
})
