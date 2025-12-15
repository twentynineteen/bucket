// src/components/uploadTrello/TrelloCardList.tsx

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@components/ui/accordion'
import React, { useState } from 'react'

import { logger } from '../logger'
import { TrelloCard } from '../TrelloCards'

interface TrelloCardListProps {
  grouped: Record<string, TrelloCard[]>
  onSelect: (card: { id: string; name: string }) => void
}

/**
 * Renders a list of Trello cards grouped by their list names.
 * Allows selecting a card by clicking its name.
 * Persists accordion state across page refreshes.
 */
const TrelloCardList: React.FC<TrelloCardListProps> = ({ grouped, onSelect }) => {
  const STORAGE_KEY = 'trello-accordion-state'
  const [openSections, setOpenSections] = useState<string[]>(() => {
    // Load accordion state from localStorage on initial render
    try {
      const savedState = localStorage.getItem(STORAGE_KEY)
      if (savedState) {
        return JSON.parse(savedState)
      }
    } catch (error) {
      logger.error('Failed to load accordion state:', error)
    }
    return []
  })

  // Save accordion state to localStorage when it changes
  const handleAccordionChange = (value: string[]) => {
    setOpenSections(value)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch (error) {
      logger.error('Failed to save accordion state:', error)
    }
  }

  if (Object.entries(grouped).length === 0) {
    return <p>No cards found.</p>
  }

  return (
    <Accordion
      type="multiple"
      className="w-full"
      value={openSections}
      onValueChange={handleAccordionChange}
    >
      {Object.entries(grouped).map(([listName, cards]) => (
        <AccordionItem key={listName} value={listName}>
          <AccordionTrigger className="text-lg font-semibold">
            {listName} ({cards.length})
          </AccordionTrigger>
          <AccordionContent>
            <ul className="ml-5 list-disc space-y-1">
              {cards.map((card) => (
                <li
                  key={card.id}
                  className="hover:bg-accent cursor-pointer rounded px-3 py-1 transition-colors"
                  onClick={() => onSelect({ id: card.id, name: card.name })}
                >
                  {card.name}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

export default TrelloCardList
