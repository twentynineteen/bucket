/**
 * WorkflowIndicator Component
 * Displays the workflow progress steps
 */

import type { WorkflowStep } from '@hooks/useScriptFormatterState'
import React from 'react'

interface WorkflowIndicatorProps {
  currentStep: WorkflowStep
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  'upload',
  'select-model',
  'processing',
  'review',
  'download'
]

export const WorkflowIndicator: React.FC<WorkflowIndicatorProps> = ({ currentStep }) => {
  return (
    <div className="mx-auto flex max-w-4xl items-center justify-between">
      {WORKFLOW_STEPS.map((step, idx) => (
        <div
          key={step}
          className={`flex items-center ${
            currentStep === step
              ? 'text-foreground font-medium'
              : 'text-muted-foreground/50'
          }`}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              currentStep === step
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {idx + 1}
          </div>
          <span className="ml-2 text-sm capitalize">{step.replace('-', ' ')}</span>
          {idx < 4 && <div className="bg-muted mx-4 h-0.5 w-12" />}
        </div>
      ))}
    </div>
  )
}
