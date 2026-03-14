/**
 * useBakerScan Hook
 *
 * Custom React hook for managing Baker folder scanning operations.
 * Handles scan initiation, progress tracking, and cancellation.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  bakerCancelScan,
  bakerStartScan,
  listenScanComplete,
  listenScanError,
  listenScanProgress
} from '../api'

import type { ScanOptions, ScanResult, UseBakerScanResult } from '../types'

export function useBakerScan(): UseBakerScanResult {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanStartTime, setScanStartTime] = useState<number | null>(null)
  const scanIdRef = useRef<string | null>(null)

  // Set up event listeners once on mount (mount-once pattern)
  // Using useRef for scanId avoids the race condition where listener
  // teardown/setup gaps caused baker_scan_complete events to be lost
  useEffect(() => {
    const unlistenPromises: Promise<() => void>[] = []

    // Progress event listener
    unlistenPromises.push(
      listenScanProgress((event) => {
        const progressData = event.payload
        if (progressData.scanId === scanIdRef.current) {
          setScanResult((prev) =>
            prev
              ? {
                  ...prev,
                  totalFolders: progressData.totalFolders,
                  validProjects: progressData.projectsFound
                }
              : null
          )
        }
      })
    )

    // Completion event listener
    unlistenPromises.push(
      listenScanComplete((event) => {
        const completeData = event.payload
        if (completeData.scanId === scanIdRef.current) {
          scanIdRef.current = null
          setScanResult(completeData.result)
          setIsScanning(false)
          setScanStartTime(null)
        }
      })
    )

    // Error event listener
    unlistenPromises.push(
      listenScanError((event) => {
        const errorData = event.payload
        if (errorData.scanId === scanIdRef.current) {
          scanIdRef.current = null
          setError(errorData.error.message)
          setIsScanning(false)
          setScanStartTime(null)
        }
      })
    )

    // Clean up listeners on unmount only
    return () => {
      Promise.all(unlistenPromises)
        .then((unlisteners) => {
          unlisteners.forEach((unlisten) => {
            if (unlisten && typeof unlisten === 'function') {
              unlisten()
            }
          })
        })
        .catch(() => {
          // Ignore cleanup errors in test environments
        })
    }
  }, [])

  const startScan = useCallback(
    async (rootPath: string, options: ScanOptions) => {
      if (isScanning) {
        return // Prevent multiple simultaneous scans
      }

      try {
        setError(null)
        setIsScanning(true)
        setScanResult(null)

        const scanId = await bakerStartScan(rootPath, options)

        // Set ref BEFORE state updates so listeners can match events immediately
        scanIdRef.current = scanId
        setScanStartTime(Date.now())
      } catch (scanError) {
        setError(
          scanError instanceof Error
            ? scanError.message
            : String(scanError)
        )
        setIsScanning(false)
        scanIdRef.current = null
      }
    },
    [isScanning]
  )

  const cancelScan = useCallback(async () => {
    if (scanIdRef.current) {
      try {
        await bakerCancelScan(scanIdRef.current)
        scanIdRef.current = null
        setIsScanning(false)
        setScanStartTime(null)
      } catch (cancelError) {
        setError(
          cancelError instanceof Error
            ? cancelError.message
            : String(cancelError)
        )
      }
    }
  }, [])

  const clearResults = useCallback(() => {
    setScanResult(null)
    setError(null)
    if (!isScanning) {
      scanIdRef.current = null
    }
    setScanStartTime(null)
  }, [isScanning])

  return {
    scanResult,
    isScanning,
    error,
    scanStartTime,
    startScan,
    cancelScan,
    clearResults
  }
}
