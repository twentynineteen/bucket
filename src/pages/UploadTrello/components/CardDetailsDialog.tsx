/**
 * CardDetailsDialog - Dialog for viewing and editing Trello card details
 * Extracted from UploadTrello.tsx (DEBT-002)
 */

import { Button } from '@components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@components/ui/dialog'
import { VideoInfoData } from '@hooks/useVideoInfoBlock'
import { appStore } from '@store/useAppStore'
import CardDetailsAccordion from '@utils/trello/CardDetailsAccordion'
import TooltipPreview from '@utils/trello/TooltipPreview'
import VideoInfoTooltip from '@utils/trello/VideoInfoTooltip'
import { TrelloCard, TrelloMember } from '@utils/TrelloCards'
import { Breadcrumb, SproutUploadResponse } from '@utils/types'
import { ExternalLink } from 'lucide-react'
import React from 'react'

import { SelectedCard } from '../UploadTrelloTypes'

interface CardDetailsDialogProps {
  selectedCard: SelectedCard | null
  selectedCardDetails: TrelloCard | null
  members: TrelloMember[] | undefined
  isCardLoading: boolean
  uploadedVideo: SproutUploadResponse | null
  mainDescription: string
  breadcrumbsData: Breadcrumb | undefined
  breadcrumbsBlock: string
  videoInfoData: VideoInfoData | null
  videoInfoBlock: string | null
  onAppendBreadcrumbs: () => Promise<void>
  onAppendVideoInfo: () => Promise<void>
  onOpenInTrello: () => Promise<void>
  onClose: () => void
}

export const CardDetailsDialog: React.FC<CardDetailsDialogProps> = ({
  selectedCard,
  selectedCardDetails,
  members,
  isCardLoading,
  uploadedVideo,
  mainDescription,
  breadcrumbsData,
  breadcrumbsBlock,
  videoInfoData,
  videoInfoBlock,
  onAppendBreadcrumbs,
  onAppendVideoInfo,
  onOpenInTrello,
  onClose
}) => {
  if (!selectedCard) return null

  const breadcrumbs: Breadcrumb = appStore.getState().breadcrumbs

  return (
    <Dialog open={!!selectedCard} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selectedCard.name}</DialogTitle>
          <DialogDescription>Card ID: {selectedCard.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {isCardLoading ? (
            <p>Loading card details...</p>
          ) : (
            <>
              {members && members.length > 0 && <MembersList members={members} />}
              {selectedCardDetails && (
                <div className="space-y-4">
                  <CardDetailsAccordion
                    description={mainDescription}
                    breadcrumbsData={breadcrumbsData}
                    breadcrumbsBlock={breadcrumbsBlock}
                    videoInfoBlock={videoInfoBlock}
                    videoInfoData={videoInfoData}
                  />
                </div>
              )}
            </>
          )}
          <DialogActions
            breadcrumbs={breadcrumbs}
            onAppendBreadcrumbs={onAppendBreadcrumbs}
            onOpenInTrello={onOpenInTrello}
            onClose={onClose}
          />
          {uploadedVideo && (
            <VideoInfoSection
              uploadedVideo={uploadedVideo}
              onAppendVideoInfo={onAppendVideoInfo}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Sub-components

interface MembersListProps {
  members: TrelloMember[]
}

const MembersList: React.FC<MembersListProps> = ({ members }) => (
  <div>
    <h3 className="font-semibold">Members</h3>
    <ul className="ml-5 list-disc text-sm">
      {members.map((member) => (
        <li key={member.id}>{member.fullName}</li>
      ))}
    </ul>
  </div>
)

interface DialogActionsProps {
  breadcrumbs: Breadcrumb | null
  onAppendBreadcrumbs: () => Promise<void>
  onOpenInTrello: () => Promise<void>
  onClose: () => void
}

const DialogActions: React.FC<DialogActionsProps> = ({
  breadcrumbs,
  onAppendBreadcrumbs,
  onOpenInTrello,
  onClose
}) => (
  <div className="flex items-center justify-between gap-4 pt-4">
    <TooltipPreview
      trigger={<Button onClick={onAppendBreadcrumbs}>Append Breadcrumbs</Button>}
      content={
        breadcrumbs ? JSON.stringify(breadcrumbs, null, 2) : 'No breadcrumbs selected'
      }
    />
    <Button variant="outline" onClick={onOpenInTrello}>
      <ExternalLink className="mr-2 h-4 w-4" />
      Open in Trello
    </Button>
    <Button onClick={onClose}>Close</Button>
  </div>
)

interface VideoInfoSectionProps {
  uploadedVideo: SproutUploadResponse
  onAppendVideoInfo: () => Promise<void>
}

const VideoInfoSection: React.FC<VideoInfoSectionProps> = ({
  uploadedVideo,
  onAppendVideoInfo
}) => (
  <div className="pt-4">
    <TooltipPreview
      trigger={
        <Button disabled={!uploadedVideo} onClick={onAppendVideoInfo}>
          Append Video Info
        </Button>
      }
      content={
        uploadedVideo ? (
          <VideoInfoTooltip video={uploadedVideo} />
        ) : (
          'No uploaded video found.'
        )
      }
    />
  </div>
)
