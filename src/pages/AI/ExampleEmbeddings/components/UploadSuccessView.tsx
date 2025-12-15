/**
 * UploadSuccessView Component
 *
 * Displays success state after a successful upload.
 */

import { CheckCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

interface UploadSuccessViewProps {
  uploadedTitle: string
  onClose: () => void
  onUploadAnother: () => void
}

export function UploadSuccessView({
  uploadedTitle,
  onClose,
  onUploadAnother
}: UploadSuccessViewProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle className="text-success h-5 w-5" />
          Upload Successful!
        </DialogTitle>
        <DialogDescription>
          Your script example has been added to the library.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="border-success/20 bg-success/10 rounded-md border p-4">
          <p className="text-success text-sm font-medium">Uploaded Example</p>
          <p className="text-success mt-1 text-lg font-semibold">{uploadedTitle}</p>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">✓ Example added to the database</p>
          <p className="text-muted-foreground text-sm">
            ✓ Available for AI-powered script formatting
          </p>
          <p className="text-muted-foreground text-sm">
            ✓ List will update automatically when you close this dialog
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button type="button" onClick={onUploadAnother}>
          Upload Another
        </Button>
      </DialogFooter>
    </>
  )
}
