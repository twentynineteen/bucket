import { Input } from '@components/ui/input'
import { useBreadcrumb } from '@hooks/useBreadcrumb'
import { useUploadTrello } from '@hooks/useUploadTrello'
import TrelloCardList from '@utils/trello/TrelloCardList'
import { Search } from 'lucide-react'
import React from 'react'

import { CardDetailsDialog } from './UploadTrello/components/CardDetailsDialog'

// Trello icon SVG component
const TrelloIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
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

const UploadTrello = () => {
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

  if (isBoardLoading || isCardLoading) return <div>Loading...</div>

  return (
    <>
      <div className="mb-4 w-full border-b pb-4">
        <h2 className="flex items-center gap-4 px-4 text-2xl font-semibold">
          <TrelloIcon />
          Trello: {boardName}
        </h2>
        <div className="mx-4 mt-4 space-y-4 px-4">
          <div className="relative">
            <Search className="text-muted-foreground/50 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search cards by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div>
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
    </>
  )
}

export default UploadTrello
