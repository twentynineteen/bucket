import { Button } from '@components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@components/ui/dialog'
import { Input } from '@components/ui/input'
import { appStore } from '@store/useAppStore'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { open } from '@tauri-apps/plugin-shell'
import TrelloCardList from '@utils/trello/TrelloCardList'
import { TrelloCard } from '@utils/TrelloCards'
import {
  useAppendBreadcrumbs,
  useFuzzySearch,
  useTrelloBoard,
  useTrelloCardDetails
} from 'hooks'
import { ExternalLink, Search } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'

import { logger } from '@/utils/logger'

interface TrelloIntegrationModalProps {
  isOpen: boolean
  onClose: () => void
}

const TrelloIntegrationModal: React.FC<TrelloIntegrationModalProps> = ({
  isOpen,
  onClose
}) => {
  // Hard-coded boardId for 'small projects' (same as UploadTrello)
  const boardId = '55a504d70bed2bd21008dc5a'

  const [selectedCard, setSelectedCard] = useState<{ id: string; name: string } | null>(
    null
  )
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)

  const { grouped, isLoading: isBoardLoading, apiKey, token } = useTrelloBoard(boardId)

  // Flatten all cards for search
  const allCards = useMemo(() => {
    const cards: TrelloCard[] = []
    Object.values(grouped).forEach((cardList) => {
      cards.push(...cardList)
    })
    return cards
  }, [grouped])

  // Use fuzzy search hook
  const {
    searchTerm,
    setSearchTerm,
    results: filteredCards
  } = useFuzzySearch(allCards, {
    keys: ['name', 'desc'],
    threshold: 0.4
  })

  // Re-group filtered cards by list
  const filteredGrouped = useMemo(() => {
    if (!searchTerm.trim()) {
      return grouped
    }

    const result: Record<string, TrelloCard[]> = {}
    filteredCards.forEach((card) => {
      Object.entries(grouped).forEach(([listName, cards]) => {
        if (cards.some((c) => c.id === card.id)) {
          if (!result[listName]) {
            result[listName] = []
          }
          result[listName].push(card)
        }
      })
    })
    return result
  }, [searchTerm, filteredCards, grouped])

  const {
    card: selectedCardDetails,
    isLoading: isCardLoading,
    refetchCard
  } = useTrelloCardDetails(selectedCard?.id ?? null, apiKey, token)

  const { getBreadcrumbsBlock, applyBreadcrumbsToCard } = useAppendBreadcrumbs(
    apiKey,
    token
  )

  useEffect(() => {
    if (selectedCard && selectedCard.id && apiKey && token) {
      refetchCard()
    }
  }, [selectedCard, apiKey, token, refetchCard])

  useEffect(() => {
    if (selectedCard && !selectedCardDetails && !isCardLoading) {
      setSelectedCard(null)
    }
  }, [selectedCard, selectedCardDetails, isCardLoading, setSelectedCard])

  const handleAppendBreadcrumbs = async () => {
    if (!selectedCardDetails) return

    try {
      setIsUpdating(true)
      setUpdateMessage(null)

      // First, add the Trello card URL to the breadcrumbs data
      const currentBreadcrumbs = appStore.getState().breadcrumbs
      const trelloCardUrl = `https://trello.com/c/${selectedCardDetails.id}`
      const updatedBreadcrumbs = {
        ...currentBreadcrumbs,
        trelloCardUrl
      }

      // Temporarily update the in-app store so getBreadcrumbsBlock includes the URL
      appStore.getState().setBreadcrumbs(updatedBreadcrumbs)

      // Generate the breadcrumbs block with the Trello URL included
      const block = await getBreadcrumbsBlock(selectedCardDetails)
      if (block && selectedCardDetails) {
        await applyBreadcrumbsToCard(selectedCardDetails, block)

        // Save the updated breadcrumbs to the local file
        if (
          currentBreadcrumbs &&
          currentBreadcrumbs.parentFolder &&
          currentBreadcrumbs.projectTitle
        ) {
          const breadcrumbsPath = `${currentBreadcrumbs.parentFolder}/${currentBreadcrumbs.projectTitle}/breadcrumbs.json`
          await writeTextFile(
            breadcrumbsPath,
            JSON.stringify(updatedBreadcrumbs, null, 2)
          )
        }

        setUpdateMessage('Successfully linked project to Trello card!')
      } else {
        setUpdateMessage('Failed to generate breadcrumbs block')
      }
    } catch (error) {
      logger.error('Error updating Trello card:', error)
      setUpdateMessage('Failed to update Trello card')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleClose = () => {
    setSelectedCard(null)
    setUpdateMessage(null)
    onClose()
  }

  if (isBoardLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to Trello</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Loading Trello cards...</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link Project to Trello Card</DialogTitle>
          <DialogDescription>
            Select a Trello card to append your project's breadcrumbs data
          </DialogDescription>
        </DialogHeader>

        {!selectedCard ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="text-muted-foreground/50 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search cards by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
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
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{selectedCard.name}</h3>
              <p className="text-muted-foreground text-sm">Card ID: {selectedCard.id}</p>
            </div>

            {updateMessage && (
              <div
                className={`rounded-md p-3 ${
                  updateMessage.includes('Success')
                    ? 'border border-green-200 bg-green-100 text-green-800'
                    : 'border border-red-200 bg-red-100 text-red-800'
                }`}
              >
                {updateMessage}
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedCard(null)}
                disabled={isUpdating}
              >
                ← Back to Cards
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (selectedCard) {
                      const url = new URL(`https://trello.com/c/${selectedCard.id}`)
                      await open(url.toString())
                    }
                  }}
                  disabled={isUpdating}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in Trello
                </Button>

                <Button
                  onClick={handleAppendBreadcrumbs}
                  disabled={isUpdating || !selectedCardDetails}
                >
                  {isUpdating ? 'Updating...' : 'Link Project'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default TrelloIntegrationModal
