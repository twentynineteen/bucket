import { Button } from '@components/ui/button'
import { STEP_CARD_ANIMATION } from '@constants/animations'
import { FolderPlus } from 'lucide-react'

interface CreateProjectStepProps {
  showSuccess: boolean
  title: string
  selectedFolder: string
  onCreateProject: () => void
}

export const CreateProjectStep: React.FC<CreateProjectStepProps> = ({
  showSuccess,
  title,
  selectedFolder,
  onCreateProject
}) => {
  const isDisabled = !title.trim() || !selectedFolder

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
            3
          </div>
          <div>
            <h2 className="text-foreground text-sm font-semibold">Create Project</h2>
            {!showSuccess && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                Review and create your project
              </p>
            )}
          </div>
        </div>
        {!showSuccess && (
          <>
            <Button
              onClick={onCreateProject}
              disabled={isDisabled}
              aria-disabled={isDisabled}
              aria-describedby={isDisabled ? 'create-btn-requirements' : undefined}
              title={
                isDisabled
                  ? 'Please enter a project title and select a folder'
                  : undefined
              }
              animationStyle="glow"
              className="from-chart-4 to-chart-5 disabled:from-muted disabled:to-muted bg-gradient-to-r px-6 py-2.5 font-semibold text-white shadow-md"
            >
              <FolderPlus className="h-4 w-4" />
              Create Project
            </Button>
            {isDisabled && (
              <span id="create-btn-requirements" className="sr-only">
                Requires project title and selected folder
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
