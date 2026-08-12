/**
 * Quality Control page (issue #180, B8.5)
 *
 * Only the I/O boundary is mocked — the availability hook, which owns the Tauri
 * calls. Everything the assertions touch is the real component, so a broken page
 * fails these tests rather than a mock reporting itself present.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { UseQcAvailabilityResult } from '../hooks/useQcAvailability'

const mockAvailability = vi.fn<() => UseQcAvailabilityResult>()

vi.mock('../hooks/useQcAvailability', () => ({
  useQcAvailability: () => mockAvailability()
}))

// Spread the real module: Button reaches for useReducedMotion from here too, and
// replacing the whole module wholesale breaks every component that renders one.
vi.mock('@shared/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared/hooks')>()),
  useBreadcrumb: vi.fn()
}))

import QualityControlPage from './QualityControlPage'

const READY: UseQcAvailabilityResult = {
  available: true,
  reason: null,
  pending: false,
  referenceFolder: '/Volumes/Brand/QC references',
  pools: {
    watermarks: { status: 'ready', reason: null },
    stings: { status: 'ready', reason: null }
  }
}

describe('QualityControlPage', () => {
  it('B8.5 offers an enabled run action when every prerequisite is ready', () => {
    mockAvailability.mockReturnValue(READY)

    render(<QualityControlPage />)

    expect(screen.getByRole('button', { name: /run quality control/i })).toBeEnabled()
  })

  it('B8.5 shows the specific reason and disables the run action when unavailable', () => {
    mockAvailability.mockReturnValue({
      ...READY,
      available: false,
      reason: 'Video QC needs ffprobe, which could not be found.'
    })

    render(<QualityControlPage />)

    expect(screen.getByRole('alert')).toHaveTextContent(/ffprobe/)
    expect(screen.getByRole('button', { name: /run quality control/i })).toBeDisabled()
  })

  it('B8.5 claims nothing while the prerequisite checks are in flight', () => {
    mockAvailability.mockReturnValue({
      ...READY,
      available: false,
      reason: null,
      pending: true
    })

    render(<QualityControlPage />)

    // Neither "ready" nor a failure may be asserted before the checks report.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /run quality control/i })).toBeDisabled()
  })

  it('B8.5 reports both pools, so a second fault is visible without fixing the first', () => {
    mockAvailability.mockReturnValue({
      ...READY,
      available: false,
      reason: 'The watermarks folder contains no reference images.',
      pools: {
        watermarks: {
          status: 'empty',
          reason: 'The watermarks folder contains no reference images.'
        },
        stings: {
          status: 'cannot-read',
          reason: 'Cannot read the stings folder: /Volumes/Brand/QC references/stings'
        }
      }
    })

    render(<QualityControlPage />)

    // The primary reason is the watermark pool, since the watermark check runs
    // first and is the fault to fix first.
    expect(screen.getByRole('alert')).toHaveTextContent(
      /watermarks folder contains no reference images/i
    )
    // The point of the behaviour: the sting fault is visible at the same time,
    // rather than only appearing once the watermark pool is fixed.
    expect(screen.getByText(/cannot read the stings folder/i)).toBeInTheDocument()
  })
})
