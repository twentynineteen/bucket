import { Label } from '@shared/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@shared/ui/select'
import { Skeleton } from '@shared/ui/skeleton'
import { TrelloBoard } from '@shared/types'
import React from 'react'

import { useTrelloBoards } from '../hooks/useTrelloBoards'
import {
  categorizeBoardStatus,
  formatBoardDisplayName,
  groupBoardsByOrganization
} from '../internal/trelloBoardValidation'

export interface TrelloBoardSelectorProps {
  /** Currently selected board ID */
  value: string
  /** Callback when board selection changes */
  onValueChange: (boardId: string) => void
  /** Label for the select */
  label?: string
  /** Placeholder text when no board is selected */
  placeholder?: string
  /** Optional CSS class name */
  className?: string
}

/**
 * Dropdown selector for choosing a Trello board from the user's available boards.
 * Boards are grouped by organization and show visibility indicators.
 */
export function TrelloBoardSelector({
  value,
  onValueChange,
  label = 'Trello Board',
  placeholder = 'Select a board',
  className
}: TrelloBoardSelectorProps) {
  const { boards, isLoading, error } = useTrelloBoards()

  const boardStatus = categorizeBoardStatus(value, boards)
  const groupedBoards = React.useMemo(() => groupBoardsByOrganization(boards), [boards])

  if (isLoading) {
    return (
      <div className={className}>
        {label && (
          <Label htmlFor="trello-board-selector" className="mb-2 block">
            {label}
          </Label>
        )}
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={className}>
        {label && (
          <Label htmlFor="trello-board-selector" className="mb-2 block">
            {label}
          </Label>
        )}
        <Select value={value} onValueChange={onValueChange} disabled>
          <SelectTrigger id="trello-board-selector" className="w-full">
            <SelectValue placeholder="Error loading boards" />
          </SelectTrigger>
        </Select>
        <p className="text-destructive mt-1 text-sm">
          Failed to load boards. Please check your API credentials.
        </p>
      </div>
    )
  }

  if (boards.length === 0) {
    return (
      <div className={className}>
        {label && (
          <Label htmlFor="trello-board-selector" className="mb-2 block">
            {label}
          </Label>
        )}
        <Select value={value} onValueChange={onValueChange} disabled>
          <SelectTrigger id="trello-board-selector" className="w-full">
            <SelectValue placeholder="No boards found" />
          </SelectTrigger>
        </Select>
        <p className="text-muted-foreground mt-1 text-sm">
          No boards found. Create your first board on{' '}
          <a
            href="https://trello.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary underline"
          >
            Trello
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      {label && (
        <Label htmlFor="trello-board-selector" className="mb-2 block">
          {label}
        </Label>
      )}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id="trello-board-selector"
          className="w-full"
          aria-label={label || 'Trello Board'}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-[400px]">
          {boardStatus === 'inaccessible' && value && (
            <div className="text-muted-foreground px-2 py-1.5 text-sm">
              <span className="text-destructive">{'\u26A0\uFE0F'}</span> Selected board is
              no longer accessible
            </div>
          )}

          {Array.from(groupedBoards.entries()).map(([orgName, orgBoards]) => (
            <SelectGroup key={orgName || 'personal'}>
              <SelectLabel>{orgName || 'Personal Boards'}</SelectLabel>
              {orgBoards.map((board: TrelloBoard) => (
                <SelectItem
                  key={board.id}
                  value={board.id}
                  aria-label={formatBoardDisplayName(board)}
                >
                  {formatBoardDisplayName(board)}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      <p className="text-muted-foreground mt-1 text-xs">
        Select the board where your project cards are managed
      </p>
    </div>
  )
}
