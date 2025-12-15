/**
 * UploadTrello Page Component
 *
 * Main page for browsing Trello cards and appending breadcrumbs/video info.
 * Refactored to use consistent UI template pattern from BuildProject/Baker pages.
 */

import ErrorBoundary from '@components/ErrorBoundary'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { useBreadcrumb } from '@hooks/useBreadcrumb'
import { useUploadTrello } from '@hooks/useUploadTrello'
import TrelloCardList from '@utils/trello/TrelloCardList'
import { AlertTriangle, RefreshCw, Search } from 'lucide-react'
import React from 'react'

import { CardDetailsDialog } from './UploadTrello/components/CardDetailsDialog'

// Trello icon SVG component
const TrelloIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    className={className}
  >
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <path d="M7 7h3v9H7zm7 0h3v5h-3z" />
    </g>
  </svg>
)

const UploadTrelloContent: React.FC = () => {
  // Page label - shadcn breadcrumb component
  useBreadcrumb([
    { label: 'Upload content', href: '/upload/trello' },
    { label: 'Trello' }
  ])

  const {
    selectedCard,
    setSelectedCard,
    searchTerm,
    setSearchTerm,
    filteredGrouped,
    isBoardLoading,
    isCardLoading,
    selectedCardDetails,
    members,
    uploadedVideo,
    boardName,
    mainDescription,
    breadcrumbsData,
    breadcrumbsBlock,
    videoInfoData,
    videoInfoBlock,
    handleAppendBreadcrumbs,
    handleAppendVideoInfo,
    handleOpenInTrello,
    handleCloseDialog
  } = useUploadTrello()

  if (isBoardLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading board...</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto">
      <div className="w-full max-w-full pb-4">
        {/* Header */}
        <div className="border-border bg-card/50 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <TrelloIcon className="text-primary h-6 w-6" />
            <div>
              <h1 className="text-foreground text-2xl font-bold">Trello: {boardName}</h1>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Browse Trello cards and append breadcrumbs or video information
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-full space-y-4 px-6 py-4">
          {/* Step 1: Search Cards */}
          <div className="bg-card border-border overflow-hidden rounded-xl border shadow-sm">
            <div className="border-border flex items-center gap-2 border-b p-4">
              <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
                1
              </div>
              <h2 className="text-foreground text-sm font-semibold">Search Cards</h2>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search className="text-muted-foreground/50 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search cards by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Card List */}
          <div className="bg-card border-border overflow-hidden rounded-xl border shadow-sm">
            <div className="border-border flex items-center gap-2 border-b p-4">
              <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
                2
              </div>
              <h2 className="text-foreground text-sm font-semibold">Select a Card</h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto p-4">
              {Object.keys(filteredGrouped).length > 0 ? (
                <TrelloCardList grouped={filteredGrouped} onSelect={setSelectedCard} />
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  {searchTerm.trim()
                    ? 'No cards found matching your search.'
                    : 'No cards available.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Details Dialog */}
      <CardDetailsDialog
        selectedCard={selectedCard}
        selectedCardDetails={selectedCardDetails}
        members={members}
        isCardLoading={isCardLoading}
        uploadedVideo={uploadedVideo}
        mainDescription={mainDescription}
        breadcrumbsData={breadcrumbsData}
        breadcrumbsBlock={breadcrumbsBlock}
        videoInfoData={videoInfoData}
        videoInfoBlock={videoInfoBlock}
        onAppendBreadcrumbs={handleAppendBreadcrumbs}
        onAppendVideoInfo={handleAppendVideoInfo}
        onOpenInTrello={handleOpenInTrello}
        onClose={handleCloseDialog}
      />
    </div>
  )
}

const UploadTrello: React.FC = () => {
  return (
    <ErrorBoundary
      fallback={(error, retry) => (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <AlertTriangle className="text-destructive mx-auto mb-4 h-12 w-12" />
            <h2 className="text-foreground mb-4 text-2xl font-semibold">Trello Error</h2>
            <div className="text-muted-foreground mb-6">
              <p>
                An error occurred while loading the Trello page. This could be due to:
              </p>
              <ul className="mt-2 space-y-1 text-left">
                <li>- Trello API connection issues</li>
                <li>- Invalid API credentials</li>
                <li>- Network connectivity problems</li>
              </ul>
              {error && process.env.NODE_ENV === 'development' && (
                <details className="bg-muted/50 border-border mt-4 rounded-md border p-4 text-left text-sm">
                  <summary className="text-foreground cursor-pointer font-medium">
                    Technical Details
                  </summary>
                  <div className="text-muted-foreground mt-2">
                    <p>
                      <strong className="text-foreground">Error:</strong> {error.message}
                    </p>
                  </div>
                </details>
              )}
            </div>
            <div className="flex justify-center gap-2">
              <Button onClick={retry} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button
                onClick={() => (window.location.href = '/upload/sprout')}
                variant="outline"
                className="flex-1"
              >
                Back to Upload
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      <UploadTrelloContent />
    </ErrorBoundary>
  )
}

export default UploadTrello
