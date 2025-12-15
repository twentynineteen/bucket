import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert'
import { Button } from '@components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'
import React from 'react'

export interface TrelloBoardErrorProps {
  /** Error message to display */
  error: Error | string
  /** Callback when retry button is clicked */
  onRetry?: () => void
  /** Callback when re-authorize button is clicked */
  onReauthorize?: () => void
  /** Optional CSS class name */
  className?: string
}

/**
 * Error component for Trello board fetching failures.
 * Shows friendly error message with options to retry or re-authorize.
 */
export function TrelloBoardError({
  error,
  onRetry,
  onReauthorize,
  className
}: TrelloBoardErrorProps) {
  const errorMessage = typeof error === 'string' ? error : error.message

  // Determine if error is auth-related
  const isAuthError =
    errorMessage.toLowerCase().includes('unauthorized') ||
    errorMessage.toLowerCase().includes('credentials') ||
    errorMessage.toLowerCase().includes('401')

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Failed to Load Boards</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{errorMessage}</p>

        {isAuthError && (
          <p className="text-sm">
            Your Trello API credentials may be invalid or expired. Please re-authorize
            with Trello.
          </p>
        )}

        <div className="flex gap-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          )}

          {isAuthError && onReauthorize && (
            <Button variant="default" size="sm" onClick={onReauthorize}>
              Re-authorize with Trello
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}
