import React from 'react'

interface ProgressBarProps {
  progress: number
  completed: boolean
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, completed }) => {
  // Show progress bar when progress is 0 or greater, but hide when completed
  if (progress < 0 || completed) {
    return null
  }

  return (
    <div
      className="bg-secondary relative h-8 w-full overflow-hidden rounded-lg"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Project creation progress"
    >
      <div
        className="bg-primary text-primary-foreground flex h-full items-center justify-center text-sm font-semibold transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-foreground text-sm font-semibold drop-shadow-sm">
          {progress.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

export default ProgressBar
