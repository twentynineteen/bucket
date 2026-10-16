/**
 * FilterBar - Filter controls for the marketplace grid (issue #336).
 * Stub - implementation follows after red tests.
 */
import React from 'react'
import type { FilterCriteria } from '../internal/filters'

export interface FilterBarProps {
  criteria: FilterCriteria
  onChange: (criteria: FilterCriteria) => void
  categories: string[]
}

const FilterBar: React.FC<FilterBarProps> = () => {
  throw new Error('not implemented')
}

export default FilterBar
