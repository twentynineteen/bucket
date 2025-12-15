import { Button } from '@components/ui/button'
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import React, { Component, ReactNode } from 'react'

import { logger } from '@/utils/logger'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
}

// Custom Error Boundary specifically designed for React Query errors
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error details
    logger.error('ErrorBoundary caught an error:', error, errorInfo)

    this.setState({
      error,
      errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, () => {
          this.setState({ hasError: false, error: undefined, errorInfo: undefined })
        })
      }

      // Default error UI
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <h2 className="text-foreground mb-4 text-2xl font-semibold">
              Something went wrong
            </h2>
            <div className="text-muted-foreground mb-6 space-y-2">
              <p>An unexpected error occurred in the application.</p>
              {this.state.error && (
                <details className="bg-muted rounded-md p-4 text-left text-sm">
                  <summary className="cursor-pointer font-medium">Error Details</summary>
                  <div className="mt-2 space-y-1">
                    <p>
                      <strong>Error:</strong> {this.state.error.message}
                    </p>
                    {this.state.errorInfo && (
                      <p>
                        <strong>Stack:</strong>
                      </p>
                    )}
                    {this.state.errorInfo && (
                      <pre className="overflow-x-auto text-xs">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              )}
            </div>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: undefined, errorInfo: undefined })
              }}
              className="w-full"
            >
              Try Again
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Wrapper component that combines ErrorBoundary with QueryErrorResetBoundary
// This provides the best error handling for React Query applications
interface QueryErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
}

export const QueryErrorBoundary: React.FC<QueryErrorBoundaryProps> = ({
  children,
  fallback
}) => {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          fallback={
            fallback ||
            ((error, retry) => (
              <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
                <div className="max-w-md">
                  <h2 className="text-foreground mb-4 text-2xl font-semibold">
                    Query Error
                  </h2>
                  <div className="text-muted-foreground mb-6">
                    <p>
                      Failed to load data. Please check your connection and try again.
                    </p>
                    {error && (
                      <details className="bg-muted mt-4 rounded-md p-4 text-left text-sm">
                        <summary className="cursor-pointer font-medium">
                          Error Details
                        </summary>
                        <div className="mt-2">
                          <p>
                            <strong>Message:</strong> {error.message}
                          </p>
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="flex justify-center gap-2">
                    <Button
                      onClick={() => {
                        reset() // Reset React Query error state
                        retry() // Reset Error Boundary state
                      }}
                      className="flex-1"
                    >
                      Retry
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.location.reload()}
                      className="flex-1"
                    >
                      Reload App
                    </Button>
                  </div>
                </div>
              </div>
            ))
          }
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}

export default ErrorBoundary
