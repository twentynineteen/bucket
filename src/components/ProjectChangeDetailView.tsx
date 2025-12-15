/**
 * Project Change Detail View Component
 *
 * Displays detailed field-by-field changes for a single project
 * with categorization and before/after value comparison.
 */

import {
  AlertCircle,
  ArrowRight,
  Camera,
  Clock,
  Edit,
  File,
  FolderOpen,
  HardDrive,
  Info,
  Minus,
  Plus,
  User
} from 'lucide-react'
import React, { useState } from 'react'

import type { DetailedFieldChange, ProjectChangeDetail } from '@/types/baker'

interface ProjectChangeDetailViewProps {
  changeDetail: ProjectChangeDetail
  isExpanded?: boolean
  onToggleExpanded?: () => void
  showMaintenanceChanges?: boolean
}

const getChangeIcon = (type: string) => {
  switch (type) {
    case 'added':
      return <Plus className="text-success h-3 w-3" />
    case 'modified':
      return <Edit className="text-warning h-3 w-3" />
    case 'removed':
      return <Minus className="text-destructive h-3 w-3" />
    default:
      return <Info className="text-muted-foreground h-3 w-3" />
  }
}

const getFieldIcon = (field: string) => {
  switch (field) {
    case 'files':
      return <File className="text-info h-4 w-4" />
    case 'numberOfCameras':
      return <Camera className="text-accent-foreground h-4 w-4" />
    case 'projectTitle':
      return <FolderOpen className="text-success h-4 w-4" />
    case 'folderSizeBytes':
      return <HardDrive className="text-muted-foreground h-4 w-4" />
    case 'createdBy':
    case 'scannedBy':
      return <User className="text-primary h-4 w-4" />
    case 'creationDateTime':
    case 'lastModified':
      return <Clock className="text-warning h-4 w-4" />
    default:
      return <Info className="text-muted-foreground h-4 w-4" />
  }
}

const getImpactColor = (impact: string) => {
  switch (impact) {
    case 'high':
      return 'text-destructive bg-destructive/10 border-destructive/20'
    case 'medium':
      return 'text-warning bg-warning/10 border-warning/20'
    case 'low':
      return 'text-foreground bg-muted border-border'
    default:
      return 'text-foreground bg-muted border-border'
  }
}

const FieldChangeItem: React.FC<{ change: DetailedFieldChange }> = ({ change }) => {
  // Use neutral styling for unchanged fields, impact-based styling for actual changes
  const containerClass =
    change.type === 'unchanged'
      ? 'text-foreground bg-muted border-border'
      : getImpactColor(change.impact)

  return (
    <div className={`rounded-lg border p-3 ${containerClass}`}>
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center space-x-2">
          {getFieldIcon(change.field)}
          <span className="text-sm font-medium">{change.fieldDisplayName}</span>
          {getChangeIcon(change.type)}
        </div>
        {/* Only show impact badge for actual changes, not unchanged fields */}
        {change.type !== 'unchanged' && (
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              change.impact === 'high'
                ? 'bg-destructive/20 text-destructive'
                : change.impact === 'medium'
                  ? 'bg-warning/20 text-warning'
                  : 'bg-muted text-foreground'
            }`}
          >
            {change.impact}
          </span>
        )}
      </div>

      {change.type === 'added' && (
        <div className="text-sm">
          <span className="text-muted-foreground">New value: </span>
          <span className="bg-success/20 text-success rounded px-2 py-1 font-mono">
            {change.formattedNewValue}
          </span>
        </div>
      )}

      {change.type === 'removed' && (
        <div className="text-sm">
          <span className="text-muted-foreground">Removed value: </span>
          <span className="bg-destructive/20 text-destructive rounded px-2 py-1 font-mono line-through">
            {change.formattedOldValue}
          </span>
        </div>
      )}

      {change.type === 'modified' && (
        <div className="space-y-1 text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-muted-foreground flex-shrink-0">From:</span>
            <span className="bg-destructive/20 text-destructive rounded px-2 py-1 font-mono line-through">
              {change.formattedOldValue}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <ArrowRight className="text-muted-foreground/50 ml-8 h-3 w-3 flex-shrink-0" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-muted-foreground flex-shrink-0">To:</span>
            <span className="bg-success/20 text-success ml-4 rounded px-2 py-1 font-mono">
              {change.formattedNewValue}
            </span>
          </div>
        </div>
      )}

      {change.type === 'unchanged' && (
        <div className="text-sm">
          <span className="text-muted-foreground">Current value: </span>
          <span className="bg-muted text-foreground rounded px-2 py-1 font-mono">
            {change.formattedOldValue}
          </span>
        </div>
      )}
    </div>
  )
}

const CategorySection: React.FC<{
  title: string
  changes: DetailedFieldChange[]
  icon: React.ReactNode
  colorClass: string
}> = ({ title, changes, icon, colorClass }) => {
  const [isExpanded, setIsExpanded] = useState(true)

  if (changes.length === 0) return null

  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex w-full items-center justify-between px-4 py-3 ${colorClass} transition-opacity hover:opacity-80`}
      >
        <div className="flex items-center space-x-2">
          {icon}
          <span className="font-medium">{title}</span>
          <span className="bg-opacity-80 rounded-full bg-white px-2 py-1 text-xs font-semibold">
            {changes.length}
          </span>
        </div>
        <div
          className={`transform transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
        >
          <ArrowRight className="h-4 w-4" />
        </div>
      </button>

      {isExpanded && (
        <div className="bg-card space-y-3 p-4">
          {changes.map((change, index) => (
            <FieldChangeItem key={`${change.field}-${index}`} change={change} />
          ))}
        </div>
      )}
    </div>
  )
}

export const ProjectChangeDetailView: React.FC<ProjectChangeDetailViewProps> = ({
  changeDetail,
  isExpanded = false,
  onToggleExpanded,
  showMaintenanceChanges = false
}) => {
  if (!changeDetail.hasChanges) {
    return (
      <div className="bg-success/10 border-success/20 rounded-lg border p-4">
        <div className="text-success flex items-center space-x-2">
          <Info className="h-4 w-4" />
          <span className="font-medium">{changeDetail.projectName}</span>
          <span>- No changes required</span>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* Project Header */}
      <div className="bg-muted border-border border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FolderOpen className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground font-medium">
              {changeDetail.projectName}
            </span>
            {changeDetail.summary.contentChanges > 0 && (
              <AlertCircle className="text-warning h-4 w-4" />
            )}
          </div>
          <div className="text-muted-foreground flex items-center space-x-2 text-sm">
            <span>{changeDetail.summary.totalChanges} changes</span>
            {onToggleExpanded && (
              <button onClick={onToggleExpanded} className="text-info hover:text-info/80">
                {isExpanded ? 'Hide Details' : 'Show Details'}
              </button>
            )}
          </div>
        </div>

        {/* Summary Pills */}
        <div className="mt-2 flex items-center space-x-2">
          {changeDetail.summary.contentChanges > 0 && (
            <span className="bg-destructive/20 text-destructive rounded-full px-2 py-1 text-xs font-medium">
              {changeDetail.summary.contentChanges} content
            </span>
          )}
          {changeDetail.summary.metadataChanges > 0 && (
            <span className="bg-warning/20 text-warning rounded-full px-2 py-1 text-xs font-medium">
              {changeDetail.summary.metadataChanges} metadata
            </span>
          )}
          {changeDetail.summary.maintenanceChanges > 0 && showMaintenanceChanges && (
            <span className="bg-muted text-foreground rounded-full px-2 py-1 text-xs font-medium">
              {changeDetail.summary.maintenanceChanges} maintenance
            </span>
          )}
        </div>
      </div>

      {/* Detailed Changes */}
      {isExpanded && (
        <div className="space-y-4 p-4">
          <CategorySection
            title="Content Changes"
            changes={changeDetail.changeCategories.content}
            icon={<AlertCircle className="h-4 w-4" />}
            colorClass="bg-destructive/20 text-destructive"
          />

          <CategorySection
            title="Metadata Changes"
            changes={changeDetail.changeCategories.metadata}
            icon={<Info className="h-4 w-4" />}
            colorClass="bg-warning/20 text-warning"
          />

          {showMaintenanceChanges && (
            <CategorySection
              title="Maintenance Changes"
              changes={changeDetail.changeCategories.maintenance}
              icon={<Clock className="h-4 w-4" />}
              colorClass="bg-muted text-foreground"
            />
          )}
        </div>
      )}
    </div>
  )
}
