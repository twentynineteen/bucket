/**
 * FilterBar - Filter controls for the marketplace grid (issue #336).
 *
 * Provides a Category combobox, Status combobox, Favourites-only checkbox,
 * Target combobox, and Search text input. Tested through the page test.
 */
import { Checkbox } from '@shared/ui/checkbox'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@shared/ui/select'
import { Search } from 'lucide-react'
import React from 'react'
import type { FilterCriteria } from '../internal/filters'
import type { MotionCategory, MotionStatus, MotionTarget } from '../types'

export interface FilterBarProps {
  criteria: FilterCriteria
  onChange: (criteria: FilterCriteria) => void
  categories: string[]
}

const CATEGORY_OPTIONS: { value: MotionCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'lower-third', label: 'Lower third' },
  { value: 'title-card', label: 'Title card' },
  { value: 'transition', label: 'Transition' },
  { value: 'data', label: 'Data' },
  { value: 'accent', label: 'Accent' }
]

const STATUS_OPTIONS: { value: MotionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'stable', label: 'Stable' },
  { value: 'experimental', label: 'Experimental' }
]

const TARGET_OPTIONS: { value: MotionTarget | 'all'; label: string }[] = [
  { value: 'all', label: 'All targets' },
  { value: 'ae', label: 'After Effects' },
  { value: 'resolve', label: 'DaVinci Resolve' },
  { value: 'mogrt-via-ae', label: 'Premiere (mogrt)' },
  { value: 'video', label: 'Video' },
  { value: 'prompt', label: 'Claude prompt' }
]

const FilterBar: React.FC<FilterBarProps> = ({ criteria, onChange }) => {
  const updateField = <K extends keyof FilterCriteria>(
    key: K,
    value: FilterCriteria[K]
  ) => {
    onChange({ ...criteria, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Category */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-category" className="text-[10px]">
          Category
        </Label>
        <Select
          value={criteria.category}
          onValueChange={v => updateField('category', v as MotionCategory | 'all')}
        >
          <SelectTrigger
            id="filter-category"
            className="h-8 w-[140px] text-xs"
            role="combobox"
            aria-label="Category"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-status" className="text-[10px]">
          Status
        </Label>
        <Select
          value={criteria.status}
          onValueChange={v => updateField('status', v as MotionStatus | 'all')}
        >
          <SelectTrigger
            id="filter-status"
            className="h-8 w-[130px] text-xs"
            role="combobox"
            aria-label="Status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Target */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-target" className="text-[10px]">
          Target
        </Label>
        <Select
          value={criteria.target}
          onValueChange={v => updateField('target', v as MotionTarget | 'all')}
        >
          <SelectTrigger
            id="filter-target"
            className="h-8 w-[150px] text-xs"
            role="combobox"
            aria-label="Target"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARGET_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Favourites only */}
      <div className="flex h-8 items-center gap-2">
        <Checkbox
          id="filter-favourites"
          checked={criteria.favouritesOnly}
          onCheckedChange={checked => updateField('favouritesOnly', checked === true)}
          aria-label="Favourites only"
        />
        <Label htmlFor="filter-favourites" className="text-xs">
          Favourites only
        </Label>
      </div>

      {/* Search */}
      <div className="relative flex-1">
        <Label htmlFor="filter-search" className="sr-only">
          Search templates
        </Label>
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          id="filter-search"
          type="search"
          role="searchbox"
          aria-label="Search templates"
          placeholder="Search templates..."
          value={criteria.search}
          onChange={e => updateField('search', e.target.value)}
          className="h-8 pl-8 text-xs"
        />
      </div>
    </div>
  )
}

export default FilterBar
