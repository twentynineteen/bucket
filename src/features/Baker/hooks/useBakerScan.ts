/**
 * useBakerScan Hook
 *
 * Custom React hook for managing Baker folder scanning operations.
 * Handles scan initiation, progress tracking, and cancellation.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  bakerCancelScan,
  bakerGetScanStatus,
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
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const completeScan = useCallback((result: ScanResult) => {
    scanIdRef.current = null
    stopPolling()
    setScanResult(result)
    setIsScanning(false)
    setScanStartTime(null)
  }, [stopPolling])

  const failScan = useCallback((message: string) => {
    scanIdRef.current = null
    stopPolling()
    setError(message)
    setIsScanning(false)
    setScanStartTime(null)
  }, [stopPolling])

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
          completeScan(completeData.result)
        }
      })
    )

    // Error event listener
    unlistenPromises.push(
      listenScanError((event) => {
        const errorData = event.payload
        if (errorData.scanId === scanIdRef.current) {
          failScan(errorData.error.message)
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
  }, [completeScan, failScan])

  // Start polling for scan status as a fallback for missed events
  const startPolling = useCallback(
    (scanId: string) => {
      stopPolling()
      pollIntervalRef.current = setInterval(async () => {
        if (!scanIdRef.current || scanIdRef.current !== scanId) {
          stopPolling()
          return
        }
        try {
          const result = await bakerGetScanStatus(scanId)
          if (result.endTime) {
            completeScan(result)
          }
        } catch {
          // Scan not found or still running — continue polling
        }
      }, 2000)
    },
    [completeScan, stopPolling]
  )

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

        // Start polling fallback after ref is set
        startPolling(scanId)
      } catch (scanError) {
        setError(scanError instanceof Error ? scanError.message : String(scanError))
        setIsScanning(false)
        scanIdRef.current = null
      }
    },
    [isScanning, startPolling]
  )

  const cancelScan = useCallback(async () => {
    if (scanIdRef.current) {
      try {
        await bakerCancelScan(scanIdRef.current)
        scanIdRef.current = null
        stopPolling()
        setIsScanning(false)
        setScanStartTime(null)
      } catch (cancelError) {
        setError(cancelError instanceof Error ? cancelError.message : String(cancelError))
      }
    }
  }, [stopPolling])

  const clearResults = useCallback(() => {
    setScanResult(null)
    setError(null)
    if (!isScanning) {
      scanIdRef.current = null
    }
    setScanStartTime(null)
  }, [isScanning])

  // Clean up polling on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

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
