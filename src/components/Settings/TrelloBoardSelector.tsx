import { Label } from '@components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@components/ui/select'
import { Skeleton } from '@components/ui/skeleton'
import { useTrelloBoards } from '@hooks/useTrelloBoards'
import { TrelloBoard } from '@types/media'
import {
  categorizeBoardStatus,
  formatBoardDisplayName,
  groupBoardsByOrganization
} from '@utils/trelloBoardValidation'
import React from 'react'

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
 * Inaccessible boards (if current value doesn't exist in fetched boards) are shown greyed out.
 */
export function TrelloBoardSelector({
  value,
  onValueChange,
  label = 'Trello Board',
  placeholder = 'Select a board',
  className
}: TrelloBoardSelectorProps) {
  const { boards, isLoading, error } = useTrelloBoards()

  // Determine the status of the currently selected board
  const boardStatus = categorizeBoardStatus(value, boards)

  // Group boards by organization for better UX
  const groupedBoards = React.useMemo(() => groupBoardsByOrganization(boards), [boards])

  // Render loading state
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

  // Render error state (component still functional, just shows message)
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

  // Render empty state
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

  // Render the select with grouped options
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
          {/* Show warning if current board is inaccessible */}
          {boardStatus === 'inaccessible' && value && (
            <div className="text-muted-foreground px-2 py-1.5 text-sm">
              <span className="text-destructive">⚠️</span> Selected board is no longer
              accessible
            </div>
          )}

          {/* Render grouped boards */}
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

      {/* Help text */}
      <p className="text-muted-foreground mt-1 text-xs">
        Select the board where your project cards are managed
      </p>
    </div>
  )
}
