/**
 * ExampleCard Component
 * Feature: 007-frontend-script-example
 *
 * Displays a single script example with metadata and actions
 */

import { Download, RefreshCw, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import type { ExampleWithMetadata } from '@/types/exampleEmbeddings'

interface ExampleCardProps {
  example: ExampleWithMetadata
  onDelete: (id: string) => void
  onReplace: (id: string) => void
  onView: (id: string) => void
  onDownload: (id: string) => void
}

export function ExampleCard({
  example,
  onDelete,
  onReplace,
  onView,
  onDownload
}: ExampleCardProps) {
  const isUserUploaded = example.source === 'user-uploaded'

  // Truncate preview text to ~200 chars
  const previewText =
    example.beforeText.length > 200
      ? example.beforeText.substring(0, 200) + '...'
      : example.beforeText

  return (
    <Card
      className="hover:bg-accent/50 @container flex cursor-pointer flex-col transition-colors"
      onClick={() => onView(example.id)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg">{example.title}</CardTitle>
            <CardDescription className="mt-1">{example.category}</CardDescription>
          </div>
          <Badge variant={isUserUploaded ? 'default' : 'secondary'}>
            {isUserUploaded ? 'Uploaded' : 'Bundled'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <p className="text-muted-foreground line-clamp-4 text-sm">{previewText}</p>

        {example.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {example.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="text-muted-foreground mt-3 flex items-center gap-3 text-xs">
          {example.wordCount && <span>{example.wordCount} words</span>}
          {example.qualityScore && <span>Quality: {example.qualityScore}/5</span>}
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onDownload(example.id)
          }}
          className="flex-1"
          title="Download"
        >
          <Download className="h-4 w-4 @[380px]:mr-2" />
          <span className="hidden @[380px]:inline">Download</span>
        </Button>
        {isUserUploaded && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onReplace(example.id)
              }}
              className="flex-1"
              title="Replace"
            >
              <RefreshCw className="h-4 w-4 @[380px]:mr-2" />
              <span className="hidden @[380px]:inline">Replace</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(example.id)
              }}
              className="flex-1"
              title="Delete"
            >
              <Trash2 className="h-4 w-4 @[380px]:mr-2" />
              <span className="hidden @[380px]:inline">Delete</span>
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
