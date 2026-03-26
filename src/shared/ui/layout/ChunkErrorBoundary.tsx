import React from 'react'

interface ChunkErrorBoundaryState {
  hasError: boolean
}

/**
 * Error boundary that catches failed dynamic imports (chunk load failures).
 * Shows a retry UI so the user can re-attempt loading the route without
 * a full page refresh.
 *
 * Only catches chunk-related errors -- all other errors are re-thrown so
 * they propagate to the outer QueryErrorBoundary.
 */
export class ChunkErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ChunkErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ChunkErrorBoundaryState {
    const message = error?.message ?? ''
    const isChunkError =
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading chunk') ||
      message.includes('Loading CSS chunk')

    if (isChunkError) {
      return { hasError: true }
    }

    // Not a chunk error -- let it propagate
    throw error
  }

  private handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-lg text-muted-foreground">Failed to load page</p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
