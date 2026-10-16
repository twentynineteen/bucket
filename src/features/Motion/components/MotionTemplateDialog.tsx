import * as DialogPrimitive from '@radix-ui/react-dialog'
import React from 'react'
import type { CatalogueEntry } from '../types'

export interface MotionTemplateDialogProps {
  template: CatalogueEntry
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Placeholder Radix Dialog - ownership passes to #337, which keeps this
 * signature (`{ template, open, onOpenChange }`) and the DialogTitle.
 */
const MotionTemplateDialog: React.FC<MotionTemplateDialogProps> = ({
  template,
  open,
  onOpenChange
}) => {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay />
        <DialogPrimitive.Content>
          <DialogPrimitive.Title>{template.template.name}</DialogPrimitive.Title>
          <DialogPrimitive.Description>
            Template preview and export
          </DialogPrimitive.Description>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default MotionTemplateDialog
