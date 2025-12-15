/**
 * UploadDialog Component
 * Feature: 007-frontend-script-example
 *
 * Modal dialog for uploading new script examples
 * Supports both .txt and .docx files
 */

import { Loader2 } from 'lucide-react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ExampleCategory } from '@/types/exampleEmbeddings'

import { FileInputField, ModelStatusIndicator, UploadSuccessView } from './components'
import { useUploadDialogForm, type UploadData } from './hooks/useUploadDialogForm'

interface UploadDialogProps {
  open: boolean
  onClose: () => void
  onUpload: (data: UploadData) => Promise<void>
}

export { type UploadData }

export function UploadDialog({ open, onClose, onUpload }: UploadDialogProps) {
  const {
    beforeFile,
    afterFile,
    title,
    setTitle,
    category,
    setCategory,
    tags,
    qualityScore,
    setQualityScore,
    errors,
    uploadSuccess,
    uploadedTitle,
    isModelReady,
    isCheckingModel,
    modelError,
    modelName,
    isLoading,
    isParsingDocx,
    isGeneratingEmbedding,
    isUploading,
    canUpload,
    handleBeforeFileChange,
    handleAfterFileChange,
    handleTagsChange,
    handleSubmit,
    handleClose,
    handleUploadAnother
  } = useUploadDialogForm({ onUpload, onClose })

  const getSubmitButtonText = () => {
    if (isParsingDocx) return 'Parsing Document...'
    if (isGeneratingEmbedding) return 'Generating Embedding...'
    if (isUploading) return 'Uploading...'
    if (!isModelReady) return 'Model Not Ready'
    return 'Upload'
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        {uploadSuccess ? (
          <UploadSuccessView
            uploadedTitle={uploadedTitle}
            onClose={handleClose}
            onUploadAnother={handleUploadAnother}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Upload Script Example</DialogTitle>
              <DialogDescription>
                Add a new script example to improve AI formatting suggestions. Supports
                .txt and .docx files.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <ModelStatusIndicator
                  isCheckingModel={isCheckingModel}
                  isModelReady={isModelReady}
                  modelName={modelName}
                  modelError={modelError}
                />

                <FileInputField
                  id="before-file"
                  label="Original Script (.txt or .docx)"
                  file={beforeFile}
                  error={errors.beforeFile}
                  disabled={isLoading}
                  onChange={handleBeforeFileChange}
                />

                <FileInputField
                  id="after-file"
                  label="Formatted Script (.txt or .docx)"
                  file={afterFile}
                  error={errors.afterFile}
                  disabled={isLoading}
                  onChange={handleAfterFileChange}
                />

                {/* Title input */}
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Tech Conference Keynote"
                    disabled={isLoading}
                  />
                  {errors.title && (
                    <p className="text-destructive mt-1 text-sm">{errors.title}</p>
                  )}
                </div>

                {/* Category select */}
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={category}
                    onValueChange={(value) => setCategory(value as ExampleCategory)}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ExampleCategory.EDUCATIONAL}>
                        Educational
                      </SelectItem>
                      <SelectItem value={ExampleCategory.BUSINESS}>Business</SelectItem>
                      <SelectItem value={ExampleCategory.NARRATIVE}>Narrative</SelectItem>
                      <SelectItem value={ExampleCategory.INTERVIEW}>Interview</SelectItem>
                      <SelectItem value={ExampleCategory.DOCUMENTARY}>
                        Documentary
                      </SelectItem>
                      <SelectItem value={ExampleCategory.USER_CUSTOM}>Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tags input */}
                <div>
                  <Label htmlFor="tags">Tags (optional, comma-separated)</Label>
                  <Input
                    id="tags"
                    value={tags.join(', ')}
                    onChange={(e) => handleTagsChange(e.target.value)}
                    placeholder="technical, formal, presentation"
                    disabled={isLoading}
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    Separate tags with commas (max 10 tags)
                  </p>
                </div>

                {/* Quality score */}
                <div>
                  <Label htmlFor="quality">Quality Score (1-5)</Label>
                  <Input
                    id="quality"
                    type="number"
                    min={1}
                    max={5}
                    value={qualityScore}
                    onChange={(e) => setQualityScore(Number(e.target.value))}
                    disabled={isLoading}
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    Higher scores will prioritize this example in AI suggestions
                  </p>
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
                <Button type="submit" disabled={!canUpload}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {getSubmitButtonText()}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
