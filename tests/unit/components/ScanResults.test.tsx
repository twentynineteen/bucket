/**
 * Test Suite: ScanResults Component
 *
 * Tests for the Baker workflow scan results display component.
 * Following TDD methodology as per DEBT-009 Phase 3.
 *
 * Test Categories:
 * 1. Rendering States (3 tests)
 * 2. Progress Display (2 tests)
 * 3. Results Summary (4 tests)
 * 4. Statistics Calculations (3 tests)
 *
 * Total: 12 tests
 */

import type { ProjectFolder, ScanResult } from '@/types/baker'
import { ScanResults } from '@components/Baker/ScanResults'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_, prop) => {
        const Component = React.forwardRef<any, any>((props, ref) => {
          const { children, ...rest} = props
          return React.createElement(prop as string, { ...rest, ref }, children)
        })
        Component.displayName = `motion.${String(prop)}`
        return Component
      }
    }
  ),
  AnimatePresence: ({ children }: any) => children
}))

// Mock formatFileSize utility
vi.mock('@utils/breadcrumbsComparison', () => ({
  formatFileSize: vi.fn((bytes: number) => {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${bytes} B`
  })
}))

describe('ScanResults Component', () => {
  // Mock data
  const mockProjects: ProjectFolder[] = [
    {
      path: '/projects/project1',
      name: 'Project 1',
      isValid: true,
      hasBreadcrumbs: true,
      staleBreadcrumbs: false,
      invalidBreadcrumbs: false,
      lastScanned: '2024-01-01T00:00:00Z',
      cameraCount: 3,
      validationErrors: []
    },
    {
      path: '/projects/project2',
      name: 'Project 2',
      isValid: true,
      hasBreadcrumbs: true,
      staleBreadcrumbs: false,
      invalidBreadcrumbs: false,
      lastScanned: '2024-01-02T00:00:00Z',
      cameraCount: 2,
      validationErrors: []
    },
    {
      path: '/projects/project3',
      name: 'Project 3',
      isValid: false,
      hasBreadcrumbs: false,
      staleBreadcrumbs: false,
      invalidBreadcrumbs: false,
      lastScanned: '2024-01-03T00:00:00Z',
      cameraCount: 0,
      validationErrors: ['Missing Footage folder']
    },
    {
      path: '/projects/project4',
      name: 'Project 4',
      isValid: true,
      hasBreadcrumbs: true,
      staleBreadcrumbs: false,
      invalidBreadcrumbs: true, // Invalid breadcrumbs
      lastScanned: '2024-01-04T00:00:00Z',
      cameraCount: 1,
      validationErrors: []
    }
  ]

  const mockScanResult: ScanResult = {
    startTime: '2024-01-01T00:00:00Z',
    endTime: '2024-01-01T00:05:00Z',
    rootPath: '/projects',
    totalFolders: 100,
    validProjects: 3,
    updatedBreadcrumbs: 1,
    createdBreadcrumbs: 2,
    totalFolderSize: 5368709120, // 5 GB
    errors: [
      {
        path: '/projects/error1',
        type: 'permission',
        message: 'Permission denied',
        timestamp: '2024-01-01T00:01:00Z'
      },
      {
        path: '/projects/error2',
        type: 'structure',
        message: 'Invalid structure',
        timestamp: '2024-01-01T00:02:00Z'
      }
    ],
    projects: mockProjects
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =================================================================
  // Test Category 1: Rendering States (3 tests)
  // =================================================================

  describe('Rendering States', () => {
    test('returns null when no scan result', () => {
      // Arrange & Act
      const { container } = render(<ScanResults scanResult={null} isScanning={false} />)

      // Assert
      expect(container.firstChild).toBeNull()
    })

    test('shows progress display when scanning', () => {
      // Arrange & Act
      render(<ScanResults scanResult={mockScanResult} isScanning={true} />)

      // Assert
      expect(screen.getByText('Scanning in progress...')).toBeInTheDocument()
      expect(screen.getByText(/100 folders scanned/i)).toBeInTheDocument()
      expect(screen.getByText(/3 projects found/i)).toBeInTheDocument()
    })

    test('shows results summary when scan complete', () => {
      // Arrange & Act
      render(<ScanResults scanResult={mockScanResult} isScanning={false} />)

      // Assert - Check for compact inline stats labels
      expect(screen.queryByText('Scanning in progress...')).not.toBeInTheDocument()
      expect(screen.getByText('Scanned:')).toBeInTheDocument()
      expect(screen.getByText('Projects:')).toBeInTheDocument()
      expect(screen.getByText('Breadcrumbs:')).toBeInTheDocument()
      expect(screen.getByText('Size:')).toBeInTheDocument()
      expect(screen.getByText('Errors:')).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 2: Progress Display (2 tests)
  // =================================================================

  describe('Progress Display', () => {
    test('displays spinner animation during scan', () => {
      // Arrange & Act
      const { container } = render(
        <ScanResults scanResult={mockScanResult} isScanning={true} />
      )

      // Assert - Check for spinner class
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    test('updates progress counts during scan', () => {
      // Arrange
      const inProgressResult: ScanResult = {
        ...mockScanResult,
        totalFolders: 50,
        validProjects: 2
      }

      // Act
      render(<ScanResults scanResult={inProgressResult} isScanning={true} />)

      // Assert
      expect(screen.getByText(/50 folders scanned/i)).toBeInTheDocument()
      expect(screen.getByText(/2 projects found/i)).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 3: Results Summary (4 tests)
  // =================================================================

  describe('Results Summary', () => {
    test('displays total folders scanned', () => {
      // Arrange & Act
      render(<ScanResults scanResult={mockScanResult} isScanning={false} />)

      // Assert - Check for compact inline format
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('Scanned:')).toBeInTheDocument()
    })

    test('displays valid projects count', () => {
      // Arrange & Act
      render(<ScanResults scanResult={mockScanResult} isScanning={false} />)

      // Assert - Check for compact inline format with success color
      const validProjectsElement = screen.getByText('3')
      expect(validProjectsElement).toBeInTheDocument()
      expect(validProjectsElement).toHaveClass('text-success')
      expect(screen.getByText('Projects:')).toBeInTheDocument()
    })

    test('displays total folder size formatted', () => {
      // Arrange & Act
      render(<ScanResults scanResult={mockScanResult} isScanning={false} />)

      // Assert - Check for compact inline format
      expect(screen.getByText('5.00 GB')).toBeInTheDocument()
      expect(screen.getByText('Size:')).toBeInTheDocument()
    })

    test('displays error count', () => {
      // Arrange & Act
      const { container } = render(
        <ScanResults scanResult={mockScanResult} isScanning={false} />
      )

      // Assert - Find the error count element by its destructive color class
      // The errors section shows scanResult.errors.length which is 2 in mockScanResult
      const errorElements = container.querySelectorAll('.text-destructive')
      const errorCountElement = Array.from(errorElements).find((el) => el.textContent === '2')
      expect(errorCountElement).toBeInTheDocument()
      expect(screen.getByText('Errors:')).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 4: Statistics Calculations (3 tests)
  // =================================================================

  describe('Statistics Calculations', () => {
    test('correctly calculates valid breadcrumbs count', () => {
      // Arrange & Act
      render(<ScanResults scanResult={mockScanResult} isScanning={false} />)

      // Assert - Should count projects with breadcrumbs AND not invalid
      // mockProjects has 2 valid breadcrumbs (project1 and project2)
      const validBreadcrumbsCount = screen.getAllByText('2')[0] // First "2" in the grid
      expect(validBreadcrumbsCount).toBeInTheDocument()
      expect(screen.getByText('Breadcrumbs:')).toBeInTheDocument()
    })

    test('correctly calculates invalid breadcrumbs count', () => {
      // Arrange & Act
      const { container } = render(<ScanResults scanResult={mockScanResult} isScanning={false} />)

      // Assert - Should count projects with invalidBreadcrumbs = true
      // mockProjects has 1 invalid breadcrumbs (project4)
      // Find the specific element in the breadcrumbs section showing invalid count
      const invalidBreadcrumbsElements = container.querySelectorAll('.text-destructive')
      const invalidBreadcrumbsElement = Array.from(invalidBreadcrumbsElements).find(
        (el) => el.textContent === '1'
      )
      expect(invalidBreadcrumbsElement).toBeInTheDocument()
      expect(screen.getByText('Breadcrumbs:')).toBeInTheDocument()
    })

    test('handles scan results with no errors', () => {
      // Arrange
      const noErrorsResult: ScanResult = {
        ...mockScanResult,
        errors: []
      }

      // Act
      render(<ScanResults scanResult={noErrorsResult} isScanning={false} />)

      // Assert - When there are no errors, the Errors section is not rendered at all
      expect(screen.queryByText('Errors:')).not.toBeInTheDocument()
    })
  })
})
