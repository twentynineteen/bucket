/**
 * ReplaceDialog Component
 * Feature: 007-frontend-script-example
 *
 * Modal dialog for replacing existing user-uploaded script examples
 * Preserves metadata (title, category, tags, quality score) from original example
 * Supports both .txt and .docx files
 */

import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDocxParser } from '@/hooks/useDocxParser'
import { useOllamaEmbedding } from '@/hooks/useOllamaEmbedding'
import type { ExampleWithMetadata } from '@/types/exampleEmbeddings'

interface ReplaceDialogProps {
  open: boolean
  example: ExampleWithMetadata | null
  onClose: () => void
  onReplace: (data: ReplaceData) => Promise<void>
}

interface ReplaceData {
  id: string
  beforeContent: string
  afterContent: string
  embedding: number[]
}

export function ReplaceDialog({ open, example, onClose, onReplace }: ReplaceDialogProps) {
  const { parseFile: parseDocx, isLoading: isParsingDocx } = useDocxParser()
  const {
    embed,
    isReady: isModelReady,
    isLoading: isCheckingModel,
    error: modelError,
    modelName
  } = useOllamaEmbedding()

  // Form state
  const [beforeFile, setBeforeFile] = useState<File | null>(null)
  const [afterFile, setAfterFile] = useState<File | null>(null)
  const [isReplacing, setIsReplacing] = useState(false)
  const [isGeneratingEmbedding, setIsGeneratingEmbedding] = useState(false)
  const [replaceSuccess, setReplaceSuccess] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Handle file selection
  const handleBeforeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setBeforeFile(file)
    if (file) {
      setErrors((prev) => ({ ...prev, beforeFile: '' }))
    }
  }

  const handleAfterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setAfterFile(file)
    if (file) {
      setErrors((prev) => ({ ...prev, afterFile: '' }))
    }
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!beforeFile) {
      newErrors.beforeFile = 'Original script file is required'
    }
    if (!afterFile) {
      newErrors.afterFile = 'Formatted script file is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Parse file content (supports both .txt and .docx)
  const parseFileContent = async (file: File): Promise<string> => {
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.docx')) {
      // Parse .docx file using mammoth
      const document = await parseDocx(file)
      return document.textContent
    } else if (fileName.endsWith('.txt')) {
      // Read .txt file directly
      return await file.text()
    } else {
      throw new Error('File must be .txt or .docx format')
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!example) {
      toast.error('No example selected')
      return
    }

    if (!validateForm()) {
      toast.error('Validation failed', {
        description: 'Please correct the errors in the form'
      })
      return
    }

    if (!beforeFile || !afterFile) return

    setIsReplacing(true)

    try {
      // Parse file contents (supports both .txt and .docx)
      const beforeContent = await parseFileContent(beforeFile)
      const afterContent = await parseFileContent(afterFile)

      // Validate content length
      if (beforeContent.trim().length < 50) {
        throw new Error('Original script is too short (minimum 50 characters)')
      }

      if (afterContent.trim().length < 50) {
        throw new Error('Formatted script is too short (minimum 50 characters)')
      }

      if (beforeContent.trim().length > 100_000) {
        throw new Error('Original script is too long (maximum 100,000 characters)')
      }

      if (afterContent.trim().length > 100_000) {
        throw new Error('Formatted script is too long (maximum 100,000 characters)')
      }

      // Generate embedding from before content
      setIsGeneratingEmbedding(true)
      let embedding: number[]
      try {
        embedding = await embed(beforeContent)
      } catch (embedError) {
        setIsGeneratingEmbedding(false)
        throw new Error(
          'Failed to generate embedding. ' +
            (embedError instanceof Error ? embedError.message : String(embedError))
        )
      } finally {
        setIsGeneratingEmbedding(false)
      }

      if (!embedding || embedding.length === 0) {
        throw new Error('Failed to generate embedding: empty result')
      }

      // Replace example
      try {
        await onReplace({
          id: example.id,
          beforeContent,
          afterContent,
          embedding
        })

        // Show success state
        setReplaceSuccess(true)

        toast.success('Example replaced', {
          description: 'Your script example has been updated successfully.'
        })
      } catch (replaceError) {
        throw new Error(
          'Failed to replace example. ' +
            (replaceError instanceof Error ? replaceError.message : String(replaceError))
        )
      }
    } catch (error) {
      toast.error('Replace failed', {
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setIsReplacing(false)
      setIsGeneratingEmbedding(false)
    }
  }

  const isLoading = isGeneratingEmbedding || isReplacing || isParsingDocx
  const canReplace = isModelReady && !isLoading

  // Handle closing dialog
  const handleClose = () => {
    setReplaceSuccess(false)
    setBeforeFile(null)
    setAfterFile(null)
    setErrors({})
    onClose()
  }

  if (!example) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        {replaceSuccess ? (
          // Success state
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="text-success h-5 w-5" />
                Replace Successful!
              </DialogTitle>
              <DialogDescription>
                Your script example has been updated in the library.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="border-success/20 bg-success/10 rounded-md border p-4">
                <p className="text-success text-sm font-medium">Replaced Example</p>
                <p className="text-success/90 mt-1 text-lg font-semibold">
                  {example.title}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  ✓ Example content updated in the database
                </p>
                <p className="text-muted-foreground text-sm">
                  ✓ Metadata preserved (title, category, tags, quality score)
                </p>
                <p className="text-muted-foreground text-sm">
                  ✓ New embedding generated for improved matching
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Replace form
          <>
            <DialogHeader>
              <DialogTitle>Replace Script Example</DialogTitle>
              <DialogDescription>
                Replace the content of "{example.title}". Metadata (title, category, tags,
                quality score) will be preserved. Supports .txt and .docx files.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Model availability status */}
                <div
                  className={`rounded-md border p-3 ${
                    isCheckingModel
                      ? 'border-info/20 bg-info/10'
                      : isModelReady
                        ? 'border-success/20 bg-success/10'
                        : 'border-destructive/20 bg-destructive/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isCheckingModel ? (
                      <>
                        <Loader2 className="text-info h-4 w-4 animate-spin" />
                        <span className="text-info text-sm">
                          Checking embedding model...
                        </span>
                      </>
                    ) : isModelReady ? (
                      <>
                        <CheckCircle className="text-success h-4 w-4" />
                        <span className="text-success text-sm">
                          Embedding model ready:{' '}
                          <code className="font-mono">{modelName}</code>
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="text-destructive h-4 w-4" />
                        <div className="flex-1">
                          <p className="text-destructive text-sm font-medium">
                            Embedding model not available
                          </p>
                          {modelError && (
                            <p className="text-destructive/90 mt-1 text-xs">
                              {modelError.message}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Current example info */}
                <div className="border-muted bg-muted/30 rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">Current Example</p>
                  <div className="text-muted-foreground space-y-1 text-sm">
                    <p>
                      <span className="font-medium">Title:</span> {example.title}
                    </p>
                    <p>
                      <span className="font-medium">Category:</span> {example.category}
                    </p>
                    {example.tags.length > 0 && (
                      <p>
                        <span className="font-medium">Tags:</span>{' '}
                        {example.tags.join(', ')}
                      </p>
                    )}
                    {example.qualityScore && (
                      <p>
                        <span className="font-medium">Quality:</span>{' '}
                        {example.qualityScore}/5
                      </p>
                    )}
                  </div>
                </div>

                {/* Before file picker */}
                <div>
                  <Label htmlFor="before-file">New Original Script (.txt or .docx)</Label>
                  <Input
                    id="before-file"
                    type="file"
                    accept=".txt,.docx"
                    onChange={handleBeforeFileChange}
                    disabled={isLoading}
                  />
                  {beforeFile && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      Selected: {beforeFile.name} ({(beforeFile.size / 1024).toFixed(1)}{' '}
                      KB)
                    </p>
                  )}
                  {errors.beforeFile && (
                    <p className="text-destructive mt-1 text-sm">{errors.beforeFile}</p>
                  )}
                </div>

                {/* After file picker */}
                <div>
                  <Label htmlFor="after-file">New Formatted Script (.txt or .docx)</Label>
                  <Input
                    id="after-file"
                    type="file"
                    accept=".txt,.docx"
                    onChange={handleAfterFileChange}
                    disabled={isLoading}
                  />
                  {afterFile && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      Selected: {afterFile.name} ({(afterFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                  {errors.afterFile && (
                    <p className="text-destructive mt-1 text-sm">{errors.afterFile}</p>
                  )}
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canReplace}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isParsingDocx
                    ? 'Parsing Document...'
                    : isGeneratingEmbedding
                      ? 'Generating Embedding...'
                      : isReplacing
                        ? 'Replacing...'
                        : !isModelReady
                          ? 'Model Not Ready'
                          : 'Replace'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
