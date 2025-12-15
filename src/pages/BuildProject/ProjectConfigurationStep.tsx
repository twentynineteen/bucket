import { STEP_CARD_ANIMATION } from '@constants/animations'

import FolderSelector from './FolderSelector'
import ProjectInputs from './ProjectInputs'

interface ProjectConfigurationStepProps {
  showSuccess: boolean
  title: string
  onTitleChange: (newTitle: string) => void
  numCameras: number
  onNumCamerasChange: (numCameras: number) => void
  titleSanitized: boolean
  selectedFolder: string
  onSelectFolder: (folder: string) => void
}

export const ProjectConfigurationStep: React.FC<ProjectConfigurationStepProps> = ({
  showSuccess,
  title,
  onTitleChange,
  numCameras,
  onNumCamerasChange,
  titleSanitized,
  selectedFolder,
  onSelectFolder
}) => {
  return (
    <div
      className="bg-card border-border max-w-full overflow-hidden rounded-xl border shadow-sm transition-all"
      style={{
        maxHeight: showSuccess
          ? STEP_CARD_ANIMATION.collapsedHeight
          : STEP_CARD_ANIMATION.expandedHeight,
        padding: showSuccess
          ? STEP_CARD_ANIMATION.collapsedPadding
          : STEP_CARD_ANIMATION.expandedPadding,
        transitionDuration: `${STEP_CARD_ANIMATION.duration}ms`,
        transitionTimingFunction: STEP_CARD_ANIMATION.easing
      }}
    >
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
          1
        </div>
        <div className="flex-1">
          <h2 className="text-foreground text-sm font-semibold">Project Configuration</h2>
          {!showSuccess && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              Set project name, cameras, and destination folder
            </p>
          )}
        </div>
        {showSuccess && (
          <span className="text-muted-foreground ml-auto text-xs">{title}</span>
        )}
      </div>
      {!showSuccess && (
        <div className="mt-3">
          <ProjectInputs
            title={title}
            onTitleChange={onTitleChange}
            numCameras={numCameras}
            onNumCamerasChange={onNumCamerasChange}
            showSanitizationWarning={titleSanitized}
          />
          <div className="mt-3">
            <FolderSelector selectedFolder={selectedFolder} onSelect={onSelectFolder} />
          </div>
        </div>
      )}
    </div>
  )
}
