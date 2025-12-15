/**
 * useUploadDialogForm Hook
 *
 * Manages form state and validation for the UploadDialog component.
 */

import { useState } from 'react'
import { toast } from 'sonner'

import { useDocxParser } from '@/hooks/useDocxParser'
import { useOllamaEmbedding } from '@/hooks/useOllamaEmbedding'
import { ExampleCategory, type ExampleMetadata } from '@/types/exampleEmbeddings'

export interface UploadData {
  beforeContent: string
  afterContent: string
  metadata: ExampleMetadata
  embedding: number[]
}

interface UseUploadDialogFormProps {
  onUpload: (data: UploadData) => Promise<void>
  onClose: () => void
}

export function useUploadDialogForm({ onUpload, onClose }: UseUploadDialogFormProps) {
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
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ExampleCategory>(ExampleCategory.USER_CUSTOM)
  const [tags, setTags] = useState<string[]>([])
  const [qualityScore, setQualityScore] = useState<number>(3)
  const [isUploading, setIsUploading] = useState(false)
  const [isGeneratingEmbedding, setIsGeneratingEmbedding] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadedTitle, setUploadedTitle] = useState('')
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

  // Handle tags input
  const handleTagsChange = (value: string) => {
    const tagArray = value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
    setTags(tagArray)
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
    if (!title.trim()) {
      newErrors.title = 'Title is required'
    }
    if (title.length > 200) {
      newErrors.title = 'Title must be 200 characters or less'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Parse file content (supports both .txt and .docx)
  const parseFileContent = async (file: File): Promise<string> => {
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.docx')) {
      const document = await parseDocx(file)
      return document.textContent
    } else if (fileName.endsWith('.txt')) {
      return await file.text()
    } else {
      throw new Error('File must be .txt or .docx format')
    }
  }

  // Validate content length
  const validateContent = (beforeContent: string, afterContent: string): void => {
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
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error('Validation failed', {
        description: 'Please correct the errors in the form'
      })
      return
    }

    if (!beforeFile || !afterFile) return

    setIsUploading(true)

    try {
      // Parse file contents
      const beforeContent = await parseFileContent(beforeFile)
      const afterContent = await parseFileContent(afterFile)

      // Validate content length
      validateContent(beforeContent, afterContent)

      // Generate embedding from before content
      setIsGeneratingEmbedding(true)
      let embedding: number[]
      try {
        embedding = await embed(beforeContent)
      } catch (embedError) {
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

      // Prepare metadata
      const metadata: ExampleMetadata = {
        title: title.trim(),
        category,
        tags: tags.length > 0 ? tags : undefined,
        qualityScore: qualityScore || undefined
      }

      // Upload
      await onUpload({
        beforeContent,
        afterContent,
        metadata,
        embedding
      })

      // Show success state
      setUploadedTitle(title.trim())
      setUploadSuccess(true)

      toast.success('Example uploaded', {
        description: 'Your script example has been added successfully.'
      })
    } catch (error) {
      toast.error('Upload failed', {
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setIsUploading(false)
      setIsGeneratingEmbedding(false)
    }
  }

  // Reset form state
  const resetForm = () => {
    setUploadSuccess(false)
    setUploadedTitle('')
    setBeforeFile(null)
    setAfterFile(null)
    setTitle('')
    setCategory(ExampleCategory.USER_CUSTOM)
    setTags([])
    setQualityScore(3)
    setErrors({})
  }

  // Handle closing dialog
  const handleClose = () => {
    resetForm()
    onClose()
  }

  // Handle upload another
  const handleUploadAnother = () => {
    resetForm()
  }

  const isLoading = isGeneratingEmbedding || isUploading || isParsingDocx
  const canUpload = isModelReady && !isLoading

  return {
    // Form state
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

    // Model state
    isModelReady,
    isCheckingModel,
    modelError,
    modelName,

    // Loading states
    isLoading,
    isParsingDocx,
    isGeneratingEmbedding,
    isUploading,
    canUpload,

    // Handlers
    handleBeforeFileChange,
    handleAfterFileChange,
    handleTagsChange,
    handleSubmit,
    handleClose,
    handleUploadAnother
  }
}
