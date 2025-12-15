import { PROJECT_LIMITS } from '@constants/project'
import { AlertCircle, Camera, FileText } from 'lucide-react'
import React from 'react'

interface ProjectInputsProps {
  title: string
  onTitleChange: (value: string) => void
  numCameras: number
  onNumCamerasChange: (value: number) => void
  showSanitizationWarning?: boolean
}

const ProjectInputs: React.FC<ProjectInputsProps> = ({
  title,
  onTitleChange,
  numCameras,
  onNumCamerasChange,
  showSanitizationWarning = false
}) => {
  return (
    <div className="flex flex-row gap-4">
      {/* Project Title Input */}
      <div className="flex-1">
        <label
          htmlFor="project-title"
          className="text-foreground mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
        >
          <FileText className="text-primary h-3.5 w-3.5" />
          Project Title
        </label>
        <input
          id="project-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="bg-secondary border-input text-foreground focus:ring-info focus:border-info hover:border-input/80 block w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 focus:ring-2"
          placeholder="e.g. DBA - IB1234 - J Doe - Introductions 060626"
        />
        {showSanitizationWarning ? (
          <div className="bg-warning/20 border-warning/40 mt-1.5 flex items-start gap-1.5 rounded-md border p-1.5">
            <AlertCircle className="text-warning mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <p className="text-warning-foreground text-xs">
              Some characters were changed to hyphens (/ \ : * ? &quot; &lt; &gt; |) to
              ensure compatibility
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground mt-1 text-xs">Enter project title here</p>
        )}
      </div>

      {/* Number of Cameras Input */}
      <div className="w-40 flex-shrink-0">
        <label
          htmlFor="number-input"
          className="text-foreground mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
        >
          <Camera className="text-primary h-3.5 w-3.5" />
          Number of Cameras
        </label>
        <input
          type="number"
          id="number-input"
          min={PROJECT_LIMITS.MIN_CAMERAS}
          max={PROJECT_LIMITS.MAX_CAMERAS}
          step="1"
          className="bg-secondary border-input text-foreground focus:ring-info focus:border-info hover:border-input/80 block w-full rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200 focus:ring-2"
          placeholder={String(PROJECT_LIMITS.DEFAULT_CAMERAS)}
          value={numCameras}
          onChange={(e) => onNumCamerasChange(Number(e.target.value))}
          required
        />
      </div>
    </div>
  )
}

export default ProjectInputs
