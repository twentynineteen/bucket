import { Button } from '@components/ui/button'
import { STEP_CARD_ANIMATION } from '@constants/animations'
import { FootageFile } from '@hooks/useCameraAutoRemap'
import { RefreshCw, Upload } from 'lucide-react'

import ProjectFileList from './ProjectFileList'

interface AddFootageStepProps {
  showSuccess: boolean
  files: FootageFile[]
  numCameras: number
  onSelectFiles: () => void
  onUpdateCamera: (index: number, camera: number) => void
  onDeleteFile: (index: number) => void
  onClearAll: () => void
}

export const AddFootageStep: React.FC<AddFootageStepProps> = ({
  showSuccess,
  files,
  numCameras,
  onSelectFiles,
  onUpdateCamera,
  onDeleteFile,
  onClearAll
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
            2
          </div>
          <div className="flex-1">
            <h2 className="text-foreground text-sm font-semibold">Add Footage</h2>
            {!showSuccess && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                Select footage files and assign camera numbers
              </p>
            )}
          </div>
          {showSuccess && files.length > 0 && (
            <span className="text-muted-foreground text-xs">
              ({files.length} file{files.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        {!showSuccess && (
          <div className="flex gap-2">
            <Button
              onClick={onSelectFiles}
              size="sm"
              className="gap-1.5 shadow-sm hover:shadow"
            >
              <Upload className="h-3.5 w-3.5" />
              Select Files
            </Button>
            {files.length > 0 && (
              <Button
                onClick={onClearAll}
                variant="outline"
                size="sm"
                className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        )}
      </div>
      {!showSuccess && (
        <div className="mt-3">
          <ProjectFileList
            files={files}
            numCameras={numCameras}
            onUpdateCamera={onUpdateCamera}
            onDeleteFile={onDeleteFile}
          />
        </div>
      )}
    </div>
  )
}
