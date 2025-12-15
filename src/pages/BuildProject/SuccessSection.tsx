import { RefreshCw } from 'lucide-react'

import { TrelloCardsManager } from '../../components/Baker/TrelloCardsManager'

interface SuccessSectionProps {
  showSuccess: boolean
  selectedFolder: string
  title: string
  trelloApiKey: string
  trelloApiToken: string
  onStartNew: () => void
}

export const SuccessSection: React.FC<SuccessSectionProps> = ({
  showSuccess,
  selectedFolder,
  title,
  trelloApiKey,
  trelloApiToken,
  onStartNew
}) => {
  // Check all required conditions
  if (!showSuccess) {
    return null
  }

  if (!selectedFolder) {
    return null
  }

  if (!title) {
    return null
  }

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 mt-4 px-6"
      data-test="success-section-visible"
    >
      <div className="from-success/10 via-success/5 border-success/30 relative overflow-hidden rounded-xl border-2 bg-gradient-to-br to-transparent p-6 shadow-lg">
        {/* Start New Project Button - Top Right */}
        <button
          onClick={onStartNew}
          className="text-foreground bg-card border-border hover:bg-secondary hover:border-primary/30 focus:ring-ring absolute top-4 right-4 z-10 inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold shadow-sm transition-all duration-200 hover:shadow focus:ring-2 focus:outline-none"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Start New Project
        </button>

        {/* Success Icon & Message */}
        <div className="mb-4 flex items-center justify-center">
          <div className="relative">
            <div className="bg-success/20 absolute inset-0 animate-pulse rounded-full blur-xl" />
            <div className="bg-success/10 border-success/30 relative rounded-full border-2 p-3">
              <svg
                className="text-success h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <h2 className="text-success mb-2 text-center text-xl font-bold">
          Project Created Successfully!
        </h2>
        <p className="text-muted-foreground mb-4 text-center text-sm">
          Your project has been created and is ready for editing
        </p>

        {/* Trello Cards Manager */}
        <TrelloCardsManager
          projectPath={selectedFolder}
          trelloApiKey={trelloApiKey}
          trelloApiToken={trelloApiToken}
          autoSyncToTrello={true}
        />
      </div>
    </div>
  )
}
