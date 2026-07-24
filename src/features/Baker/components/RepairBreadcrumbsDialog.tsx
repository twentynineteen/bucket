/**
 * Repair Breadcrumbs Dialog
 *
 * Confirmation dialog shown before regenerating an unparseable breadcrumbs.json
 * from the folder contents. The repair always writes breadcrumbs.json.bak
 * first and salvages linked Trello cards / video links where possible.
 */

import { Wrench } from 'lucide-react'
import React from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@shared/ui/alert-dialog'

interface RepairBreadcrumbsDialogProps {
  open: boolean
  projectName: string | null
  isRepairing: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export const RepairBreadcrumbsDialog: React.FC<RepairBreadcrumbsDialogProps> = ({
  open,
  projectName,
  isRepairing,
  onOpenChange,
  onConfirm
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Repair breadcrumbs
        </AlertDialogTitle>
        <AlertDialogDescription>
          The breadcrumbs file for{' '}
          <span className="text-foreground font-medium">
            {projectName ?? 'this project'}
          </span>{' '}
          is unparseable and will be rebuilt from the folder contents. Linked Trello cards
          and video links are preserved where possible, and the current file is saved as a
          backup (breadcrumbs.json.bak) first.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isRepairing}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          disabled={isRepairing}
          onClick={(e) => {
            e.preventDefault()
            onConfirm()
          }}
        >
          {isRepairing ? 'Repairing…' : 'Repair'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)
