/**
 * ViewExampleDialog Component
 * Feature: 007-frontend-script-example
 *
 * Modal dialog for viewing full script example content
 */

import { FileText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ExampleWithMetadata } from '@/types/exampleEmbeddings'

interface ViewExampleDialogProps {
  open: boolean
  example: ExampleWithMetadata | null
  onClose: () => void
}

export function ViewExampleDialog({ open, example, onClose }: ViewExampleDialogProps) {
  if (!example) return null

  const isUserUploaded = example.source === 'user-uploaded'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[80vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5" />
            {example.title}
          </DialogTitle>

          <div className="mt-2 flex items-center gap-3">
            <DialogDescription className="flex-1">
              {example.category}
              {example.wordCount && ` • ${example.wordCount} words`}
              {example.qualityScore && ` • Quality: ${example.qualityScore}/5`}
            </DialogDescription>
            <Badge
              variant={isUserUploaded ? 'default' : 'secondary'}
              className="shrink-0"
            >
              {isUserUploaded ? 'Uploaded' : 'Bundled'}
            </Badge>
          </div>

          {example.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {example.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </DialogHeader>

        <Tabs defaultValue="before" className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="before">Original Script</TabsTrigger>
            <TabsTrigger value="after">Formatted Script</TabsTrigger>
          </TabsList>

          <TabsContent value="before" className="mt-4 flex-1 overflow-y-auto">
            <div className="bg-muted/50 rounded-md border p-4">
              <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {example.beforeText}
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="after" className="mt-4 flex-1 overflow-y-auto">
            <div className="bg-muted/50 rounded-md border p-4">
              <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {example.afterText}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
