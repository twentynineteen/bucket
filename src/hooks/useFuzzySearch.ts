import Fuse from 'fuse.js'
import { useMemo, useState } from 'react'

interface UseFuzzySearchOptions {
  keys: string[]
  threshold?: number
  includeMatches?: boolean
}

export function useFuzzySearch<T>(items: T[], options: UseFuzzySearchOptions) {
  const [searchTerm, setSearchTerm] = useState('')

  // Use JSON.stringify for deep comparison to prevent unnecessary Fuse.js rebuilds
  // This is acceptable because the stringify operation is fast for typical use cases
  // and prevents expensive Fuse.js re-initialization
  const itemsKey = JSON.stringify(items)
  const optionsKey = JSON.stringify(options)

  const fuse = useMemo(() => {
    return new Fuse(items, {
      keys: options.keys,
      threshold: options.threshold ?? 0.3,
      includeMatches: options.includeMatches ?? false,
      ignoreLocation: true,
      minMatchCharLength: 2
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, optionsKey])

  const results = useMemo(() => {
    if (!searchTerm.trim()) {
      return items
    }
    return fuse.search(searchTerm).map((result) => result.item)
  }, [fuse, searchTerm, items])

  return {
    searchTerm,
    setSearchTerm,
    results
  }
}
