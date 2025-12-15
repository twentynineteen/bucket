/**
 * SelectModelStep Component
 * Step 2: AI Provider and Model Selection
 */

import { Button } from '@components/ui/button'
import { Database, Sparkles } from 'lucide-react'
import React from 'react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import type { ExampleWithMetadata } from '@/types/exampleEmbeddings'
import type {
  AIModel,
  AIProvider,
  ProviderConfiguration,
  ScriptDocument
} from '@/types/scriptFormatter'

import { ExampleToggleList } from '../ExampleToggleList'
import { ModelSelector } from '../ModelSelector'
import { ProviderSelector } from '../ProviderSelector'

interface SelectModelStepProps {
  document: ScriptDocument | null
  activeProvider: AIProvider | null
  availableProviders: AIProvider[]
  models: AIModel[]
  selectedModelId: string | null
  isLoadingModels: boolean
  isValidatingProvider: boolean
  isEmbeddingLoading: boolean
  isEmbeddingReady: boolean
  embeddingError: Error | null
  allExamples: ExampleWithMetadata[]
  enabledExampleIds: Set<string>
  isLoadingExamples: boolean
  onProviderSelect: (providerId: string) => void
  onProviderValidate: (providerId: string, config: ProviderConfiguration) => void
  onModelSelect: (modelId: string) => void
  onExampleToggle: (exampleId: string) => void
  onFormatScript: () => void
}

export const SelectModelStep: React.FC<SelectModelStepProps> = ({
  document,
  activeProvider,
  availableProviders,
  models,
  selectedModelId,
  isLoadingModels,
  isValidatingProvider,
  isEmbeddingLoading,
  isEmbeddingReady,
  embeddingError,
  allExamples,
  enabledExampleIds,
  isLoadingExamples,
  onProviderSelect,
  onProviderValidate,
  onModelSelect,
  onExampleToggle,
  onFormatScript
}) => {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* File uploaded confirmation */}
      <div className="bg-success/10 border-success/20 rounded-lg border p-4">
        <p className="text-success text-sm">
          ✓ File uploaded: <strong>{document?.filename}</strong> ({document?.fileSize}{' '}
          bytes)
        </p>
      </div>

      {/* RAG/Embedding Status & Example Selection */}
      <Accordion
        type="multiple"
        defaultValue={['rag-status', 'example-selection']}
        className="space-y-4"
      >
        {/* RAG/Embedding Status */}
        <AccordionItem value="rag-status" className="rounded-lg border px-4">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="text-sm font-medium">RAG Enhancement Status</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <RAGStatusContent
              isLoading={isEmbeddingLoading}
              isReady={isEmbeddingReady}
              error={embeddingError}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Example Selection */}
        {isEmbeddingReady && allExamples.length > 0 && (
          <AccordionItem value="example-selection" className="rounded-lg border px-4">
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="text-sm font-medium">Select Examples to Use</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-muted-foreground mb-3 text-xs">
                Choose which examples the AI should reference when formatting your script.
                The system will automatically select the most relevant enabled examples.
              </p>
              <ExampleToggleList
                examples={allExamples}
                enabledIds={enabledExampleIds}
                onToggle={onExampleToggle}
                isLoading={isLoadingExamples}
              />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Two-column grid for provider and model selection */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left column: AI Provider */}
        <div className="border-border max-h-[200px] overflow-y-auto rounded-lg border p-6">
          <ProviderSelector
            providers={availableProviders}
            activeProvider={activeProvider}
            onSelect={onProviderSelect}
            onValidate={onProviderValidate}
            isValidating={isValidatingProvider}
          />
        </div>

        {/* Right column: Model Selector */}
        <div className="border-border max-h-[200px] overflow-y-auto rounded-lg border p-6">
          {activeProvider?.status === 'configured' ? (
            <ModelSelector
              models={models}
              selectedModel={selectedModelId}
              onSelect={onModelSelect}
              isLoading={isLoadingModels}
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              <p className="text-sm">Select and validate an AI provider to see models</p>
            </div>
          )}
        </div>
      </div>

      {/* Format button */}
      {selectedModelId && activeProvider?.status === 'configured' && (
        <Button onClick={onFormatScript} className="mb-3 w-full" size="lg">
          <Sparkles className="mr-2 h-5 w-5" />
          Format Script with AI
        </Button>
      )}
    </div>
  )
}

// Sub-component for RAG status content
const RAGStatusContent: React.FC<{
  isLoading: boolean
  isReady: boolean
  error: Error | null
}> = ({ isLoading, isReady, error }) => {
  if (isLoading) {
    return (
      <p className="text-info text-sm">Checking Ollama embedding model availability...</p>
    )
  }

  if (isReady) {
    return (
      <p className="text-success text-sm">
        ✓ RAG system ready (Ollama) - will use similar examples to improve formatting
      </p>
    )
  }

  if (error) {
    return (
      <div className="text-destructive text-sm">
        <p className="font-medium">⚠ RAG system not available</p>
        <p className="mt-1 text-xs">{error.message}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Will format without example guidance.
        </p>
      </div>
    )
  }

  return (
    <p className="text-muted-foreground text-sm">
      RAG system not available - will format without example guidance
    </p>
  )
}
