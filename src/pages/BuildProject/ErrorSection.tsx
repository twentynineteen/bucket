import { AlertCircle, FileX, RefreshCw } from 'lucide-react'

import type { FootageFile } from '@/hooks/useCameraAutoRemap'

interface ErrorSectionProps {
  showError: boolean
  error: string | null
  expectedFiles: FootageFile[]
  movedFiles: string[]
  onRetry: () => void
}

export const ErrorSection: React.FC<ErrorSectionProps> = ({
  showError,
  error,
  expectedFiles,
  movedFiles,
  onRetry
}) => {
  if (!showError || !error) {
    return null
  }

  const totalFiles = expectedFiles.length
  const successCount = movedFiles.length
  const failedCount = totalFiles - successCount

  // Determine which files failed by comparing expected vs moved
  // movedFiles contains destination paths, expectedFiles contains source info
  const movedFileNames = new Set(
    movedFiles.map((path) => {
      const parts = path.split('/')
      return parts[parts.length - 1]
    })
  )

  const failedFiles = expectedFiles.filter((f) => !movedFileNames.has(f.file.name))

  // Determine error type for appropriate messaging
  const isTimeout = error.toLowerCase().includes('timeout')
  const isPartialFailure = error.toLowerCase().includes('partial')
  const isDiskSpace = error.toLowerCase().includes('disk space')

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 mt-4 px-6"
      data-test="error-section-visible"
    >
      <div className="from-destructive/10 via-destructive/5 border-destructive/30 relative overflow-hidden rounded-xl border-2 bg-gradient-to-br to-transparent p-6 shadow-lg">
        {/* Try Again Button - Top Right */}
        <button
          onClick={onRetry}
          className="text-foreground bg-card border-border hover:bg-secondary hover:border-primary/30 focus:ring-ring absolute top-4 right-4 z-10 inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold shadow-sm transition-all duration-200 hover:shadow focus:ring-2 focus:outline-none"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try Again
        </button>

        {/* Error Icon & Message */}
        <div className="mb-4 flex items-center justify-center">
          <div className="relative">
            <div className="bg-destructive/20 absolute inset-0 animate-pulse rounded-full blur-xl" />
            <div className="bg-destructive/10 border-destructive/30 relative rounded-full border-2 p-3">
              <AlertCircle className="text-destructive h-8 w-8" />
            </div>
          </div>
        </div>

        <h2 className="text-destructive mb-2 text-center text-xl font-bold">
          {isPartialFailure ? 'Partial Copy Failure' : 'Copy Failed'}
        </h2>

        <p className="text-muted-foreground mb-4 text-center text-sm">{error}</p>

        {/* File Statistics */}
        {totalFiles > 0 && (
          <div className="bg-card/50 mb-4 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wider">Total</div>
                <div className="text-foreground text-2xl font-bold">{totalFiles}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-green-500">Succeeded</div>
                <div className="text-2xl font-bold text-green-500">{successCount}</div>
              </div>
              <div>
                <div className="text-destructive text-xs uppercase tracking-wider">Failed</div>
                <div className="text-destructive text-2xl font-bold">{failedCount}</div>
              </div>
            </div>
          </div>
        )}

        {/* Failed Files List */}
        {failedFiles.length > 0 && (
          <div className="bg-card/50 rounded-lg p-4">
            <h3 className="text-foreground mb-2 text-sm font-semibold">
              Failed Files ({failedFiles.length})
            </h3>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {failedFiles.map((file, index) => (
                <li
                  key={index}
                  className="text-muted-foreground flex items-center gap-2 text-xs"
                >
                  <FileX className="text-destructive h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{file.file.name}</span>
                  <span className="text-muted-foreground/60 flex-shrink-0">
                    (Camera {file.camera})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Remediation Suggestions */}
        <div className="border-border/50 mt-4 border-t pt-4">
          <h3 className="text-foreground mb-2 text-sm font-semibold">Suggested Actions</h3>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {isTimeout && (
              <>
                <li>Check that the destination drive is connected and accessible</li>
                <li>Try copying files to a local drive first</li>
                <li>Check network connection if using a network drive</li>
              </>
            )}
            {isDiskSpace && (
              <>
                <li>Free up space on the destination drive</li>
                <li>Choose a different destination with more space</li>
              </>
            )}
            {isPartialFailure && !isTimeout && !isDiskSpace && (
              <>
                <li>Check file permissions on source files</li>
                <li>Ensure source files are not in use by another application</li>
                <li>Try copying the failed files manually</li>
              </>
            )}
            {!isTimeout && !isDiskSpace && !isPartialFailure && (
              <>
                <li>Check that you have write permissions to the destination</li>
                <li>Ensure the destination drive has sufficient space</li>
                <li>Try again or contact support if the issue persists</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
