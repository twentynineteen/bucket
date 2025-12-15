/**
 * ExampleList Component
 * Feature: 007-frontend-script-example
 *
 * Grid display of script examples with loading and empty states
 */

import { FileText } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import type { ExampleWithMetadata } from '@/types/exampleEmbeddings'

import { ExampleCard } from './ExampleCard'

interface ExampleListProps {
  examples: ExampleWithMetadata[]
  isLoading: boolean
  onDelete: (id: string) => void
  onReplace: (id: string) => void
  onView: (id: string) => void
  onDownload: (id: string) => void
}

export function ExampleList({
  examples,
  isLoading,
  onDelete,
  onReplace,
  onView,
  onDownload
}: ExampleListProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (examples.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FileText className="text-muted-foreground mb-4 h-12 w-12" />
        <h3 className="mb-2 text-lg font-semibold">No examples found</h3>
        <p className="text-muted-foreground text-sm">
          Upload your first script example to get started with AI-powered formatting.
        </p>
      </div>
    )
  }

  // Grid of examples
  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {examples.map((example) => (
        <ExampleCard
          key={example.id}
          example={example}
          onDelete={onDelete}
          onReplace={onReplace}
          onView={onView}
          onDownload={onDownload}
        />
      ))}
    </div>
  )
}
