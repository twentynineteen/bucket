/**
 * ScriptFormatter Page
 * Feature: 006-i-wish-to (T048)
 * Purpose: Main page orchestration for AI-powered autocue script formatting
 * Refactored: 2025-11-18 - Extracted state to useScriptFormatterState, step components to /steps
 */

import ErrorBoundary from '@components/ErrorBoundary'
import { Button } from '@components/ui/button'
import { useBreadcrumb } from '@hooks/index'
import { useScriptFormatterState } from '@hooks/useScriptFormatterState'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import React from 'react'

import { FileUploader } from './FileUploader'
import { SaveExampleDialog } from './SaveExampleDialog'
import {
  DownloadCompleteStep,
  ProcessingStep,
  ReviewStep,
  SelectModelStep,
  WorkflowIndicator
} from './steps'

const ScriptFormatterContent: React.FC = () => {
  useBreadcrumb([
    { label: 'AI tools', href: '/ai-tools/script-formatter' },
    { label: 'Autocue script formatter' }
  ])

  const {
    // State
    currentStep,
    document,
    selectedModelId,
    processedOutput,
    modifiedText,
    examplesCount,
    ragStatus,
    showSaveDialog,
    enabledExampleIds,
    isValidatingProvider,

    // Loading states
    isParsing,
    isGenerating,
    isLoadingModels,
    isLoadingExamples,
    isEmbeddingLoading,
    isEmbeddingReady,

    // Errors
    parseError,
    generateError,
    processingError,
    embeddingError,

    // Data
    models,
    allExamples,
    activeProvider,
    availableProviders,
    progress,

    // Handlers
    handleFileSelect,
    handleProviderValidate,
    handleFormatScript,
    handleModifiedChange,
    handleDownload,
    handleSaveAsExample,
    handleStartOver,
    handleExampleToggle,
    goToStep,
    setSelectedModelId,
    setShowSaveDialog,
    switchProvider,
    cancelProcessing
  } = useScriptFormatterState()

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto">
      <div className="w-full max-w-full pb-4">
        {/* Header */}
        <div className="border-border bg-card/50 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground text-2xl font-bold">
                Autocue Script Formatter
              </h1>
              <p className="text-muted-foreground mt-0.5 text-xs">
                AI-powered formatting for autocue scripts with intelligent example
                matching
              </p>
            </div>
            {currentStep !== 'upload' && (
              <Button onClick={handleStartOver} variant="outline" size="sm">
                Start Over
              </Button>
            )}
          </div>
        </div>

        <div className="max-w-full space-y-4 px-6 py-4">
          {/* Workflow Progress Indicator */}
          <WorkflowIndicator currentStep={currentStep} />

          {/* Step 1: Upload File */}
          {currentStep === 'upload' && (
            <div className="mx-auto max-w-2xl space-y-6">
              <FileUploader
                onFileSelect={handleFileSelect}
                isLoading={isParsing}
                error={parseError}
              />
            </div>
          )}

          {/* Step 2: Select Model */}
          {currentStep === 'select-model' && (
            <SelectModelStep
              document={document}
              activeProvider={activeProvider}
              availableProviders={availableProviders}
              models={models}
              selectedModelId={selectedModelId}
              isLoadingModels={isLoadingModels}
              isValidatingProvider={isValidatingProvider}
              isEmbeddingLoading={isEmbeddingLoading}
              isEmbeddingReady={isEmbeddingReady}
              embeddingError={embeddingError}
              allExamples={allExamples}
              enabledExampleIds={enabledExampleIds}
              isLoadingExamples={isLoadingExamples}
              onProviderSelect={switchProvider}
              onProviderValidate={handleProviderValidate}
              onModelSelect={setSelectedModelId}
              onExampleToggle={handleExampleToggle}
              onFormatScript={handleFormatScript}
            />
          )}

          {/* Step 3: Processing */}
          {currentStep === 'processing' && (
            <ProcessingStep
              progress={progress}
              ragStatus={ragStatus}
              processingError={processingError}
              onCancel={cancelProcessing}
              onRetry={() => goToStep('select-model')}
            />
          )}

          {/* Step 4: Review & Edit */}
          {currentStep === 'review' && processedOutput && (
            <ReviewStep
              originalText={document?.textContent || ''}
              modifiedText={modifiedText}
              examplesCount={examplesCount}
              isGenerating={isGenerating}
              generateError={generateError}
              onModifiedChange={handleModifiedChange}
              onDownload={handleDownload}
              onOpenSaveDialog={() => setShowSaveDialog(true)}
            />
          )}

          {/* Step 5: Download Complete */}
          {currentStep === 'download' && (
            <DownloadCompleteStep onFormatAnother={handleStartOver} />
          )}
        </div>
      </div>

      {/* Save Example Dialog */}
      <SaveExampleDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSaveAsExample}
        defaultTitle={document?.filename.replace('.docx', '') || 'Untitled Script'}
      />
    </div>
  )
}

const ScriptFormatter: React.FC = () => {
  return (
    <ErrorBoundary
      fallback={(error, retry) => (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <AlertTriangle className="text-destructive mx-auto mb-4 h-12 w-12" />
            <h2 className="text-foreground mb-4 text-2xl font-semibold">
              Script Formatter Error
            </h2>
            <div className="text-muted-foreground mb-6">
              <p>
                An error occurred while loading the Script Formatter. This could be due
                to:
              </p>
              <ul className="mt-2 space-y-1 text-left">
                <li>• AI model configuration issues</li>
                <li>• File parsing problems</li>
                <li>• Network connectivity issues</li>
              </ul>
              {error && process.env.NODE_ENV === 'development' && (
                <details className="bg-muted/50 border-border mt-4 rounded-md border p-4 text-left text-sm">
                  <summary className="text-foreground cursor-pointer font-medium">
                    Technical Details
                  </summary>
                  <div className="text-muted-foreground mt-2">
                    <p>
                      <strong className="text-foreground">Error:</strong> {error.message}
                    </p>
                  </div>
                </details>
              )}
            </div>
            <div className="flex justify-center gap-2">
              <Button onClick={retry} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button
                onClick={() => (window.location.href = '/ai-tools/script-formatter')}
                variant="outline"
                className="flex-1"
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      <ScriptFormatterContent />
    </ErrorBoundary>
  )
}

export default ScriptFormatter
