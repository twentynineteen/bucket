/**
 * DeleteConfirm Component
 * Feature: 007-frontend-script-example
 *
 * Confirmation dialog for deleting script examples
 */

import { Loader2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'

interface DeleteConfirmProps {
  open: boolean
  exampleTitle: string
  isDeleting: boolean
  onClose: () => void
  onConfirm: () => void
}

export function DeleteConfirm({
  open,
  exampleTitle,
  isDeleting,
  onClose,
  onConfirm
}: DeleteConfirmProps) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Example?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{exampleTitle}</strong>? This action
            cannot be undone and will permanently remove this example from your library.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
