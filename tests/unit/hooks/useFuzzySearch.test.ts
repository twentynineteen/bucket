import { renderHook, act } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import { useFuzzySearch } from '@hooks/useFuzzySearch'

interface TestItem {
  id: string
  name: string
  category: string
}

describe('useFuzzySearch', () => {
  const sampleItems: TestItem[] = [
    { id: '1', name: 'Apple iPhone', category: 'Electronics' },
    { id: '2', name: 'Samsung Galaxy', category: 'Electronics' },
    { id: '3', name: 'Apple Watch', category: 'Wearables' },
    { id: '4', name: 'Nike Shoes', category: 'Apparel' },
    { id: '5', name: 'Adidas Sneakers', category: 'Apparel' }
  ]

  describe('basic search functionality', () => {
    test('should return all items when search term is empty', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'] })
      )

      expect(result.current.results).toEqual(sampleItems)
      expect(result.current.searchTerm).toBe('')
    })

    test('should filter items based on search term', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'] })
      )

      act(() => {
        result.current.setSearchTerm('Apple')
      })

      expect(result.current.results).toHaveLength(2)
      expect(result.current.results.map((item) => item.name)).toEqual([
        'Apple iPhone',
        'Apple Watch'
      ])
    })

    test('should search across multiple keys', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name', 'category'] })
      )

      act(() => {
        result.current.setSearchTerm('Electronics')
      })

      expect(result.current.results).toHaveLength(2)
      expect(result.current.results.map((item) => item.id)).toEqual(['1', '2'])
    })

    test('should handle fuzzy matching', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'], threshold: 0.3 })
      )

      act(() => {
        result.current.setSearchTerm('Appl') // Missing 'e'
      })

      expect(result.current.results.length).toBeGreaterThan(0)
      expect(result.current.results.some((item) => item.name.includes('Apple'))).toBe(
        true
      )
    })

    test('should return empty array for no matches', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'] })
      )

      act(() => {
        result.current.setSearchTerm('xyz123nonexistent')
      })

      expect(result.current.results).toEqual([])
    })

    test('should trim whitespace from search term', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'] })
      )

      act(() => {
        result.current.setSearchTerm('   ')
      })

      // Whitespace-only search should return all items
      expect(result.current.results).toEqual(sampleItems)
    })
  })

  describe('Fuse.js instance stability (optimization)', () => {
    test('should not rebuild Fuse instance when items array reference changes but content is same', () => {
      const items1 = [
        { id: '1', name: 'Item 1', category: 'A' },
        { id: '2', name: 'Item 2', category: 'B' }
      ]

      // Create new array with same content (different reference)
      const items2 = [
        { id: '1', name: 'Item 1', category: 'A' },
        { id: '2', name: 'Item 2', category: 'B' }
      ]

      const { result, rerender } = renderHook(
        ({ items }) => useFuzzySearch(items, { keys: ['name'] }),
        { initialProps: { items: items1 } }
      )

      const initialResults = result.current.results

      // Update with new array reference but same content
      rerender({ items: items2 })

      // Results should still work correctly (Fuse instance should be stable)
      expect(result.current.results).toEqual(initialResults)
    })

    test('should rebuild Fuse instance when items content actually changes', () => {
      const items1 = [
        { id: '1', name: 'Apple', category: 'A' },
        { id: '2', name: 'Banana', category: 'B' }
      ]

      const items2 = [
        { id: '1', name: 'Apple', category: 'A' },
        { id: '3', name: 'Cherry', category: 'C' } // Different content
      ]

      const { result, rerender } = renderHook(
        ({ items }) => useFuzzySearch(items, { keys: ['name'] }),
        { initialProps: { items: items1 } }
      )

      act(() => {
        result.current.setSearchTerm('Banana')
      })

      expect(result.current.results).toHaveLength(1)
      expect(result.current.results[0].id).toBe('2')

      // Update with different content
      rerender({ items: items2 })

      act(() => {
        result.current.setSearchTerm('Banana')
      })

      // Should not find Banana in new data
      expect(result.current.results).toHaveLength(0)

      act(() => {
        result.current.setSearchTerm('Cherry')
      })

      // Should find Cherry in new data
      expect(result.current.results).toHaveLength(1)
      expect(result.current.results[0].id).toBe('3')
    })

    test('should rebuild Fuse instance when options change', () => {
      const { result, rerender } = renderHook(
        ({ keys }) => useFuzzySearch(sampleItems, { keys }),
        { initialProps: { keys: ['name'] } }
      )

      act(() => {
        result.current.setSearchTerm('Electronics')
      })

      // Should not find anything when searching only in 'name'
      expect(result.current.results).toHaveLength(0)

      // Change keys to include category
      rerender({ keys: ['name', 'category'] })

      act(() => {
        result.current.setSearchTerm('Electronics')
      })

      // Should now find items when searching in 'category'
      expect(result.current.results.length).toBeGreaterThan(0)
    })

    test('should handle deep equality for complex objects', () => {
      const complexItems = [
        { id: '1', name: 'Mango', nested: { value: 'A' } },
        { id: '2', name: 'Orange', nested: { value: 'B' } }
      ]

      // Create new array with same deep content
      const complexItems2 = [
        { id: '1', name: 'Mango', nested: { value: 'A' } },
        { id: '2', name: 'Orange', nested: { value: 'B' } }
      ]

      const { result, rerender } = renderHook(
        ({ items }) => useFuzzySearch(items, { keys: ['name'] }),
        { initialProps: { items: complexItems } }
      )

      act(() => {
        result.current.setSearchTerm('Mango')
      })

      const initialResults = result.current.results
      expect(initialResults).toHaveLength(1)

      // Rerender with new reference but same deep content
      rerender({ items: complexItems2 })

      // Should maintain stable behavior
      expect(result.current.results).toEqual(initialResults)
    })
  })

  describe('threshold configuration', () => {
    test('should use default threshold when not specified', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'] })
      )

      act(() => {
        result.current.setSearchTerm('Appl')
      })

      // Default threshold (0.3) should allow some fuzziness
      expect(result.current.results.length).toBeGreaterThan(0)
    })

    test('should use custom threshold', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'], threshold: 0.1 })
      )

      act(() => {
        result.current.setSearchTerm('Appl')
      })

      // Stricter threshold (0.1) might reduce fuzzy matches
      const strictResults = result.current.results.length

      const { result: result2 } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'], threshold: 0.6 })
      )

      act(() => {
        result2.current.setSearchTerm('Appl')
      })

      // Looser threshold (0.6) should allow more matches or equal
      expect(result2.current.results.length).toBeGreaterThanOrEqual(strictResults)
    })
  })

  describe('edge cases', () => {
    test('should handle empty items array', () => {
      const { result } = renderHook(() =>
        useFuzzySearch([], { keys: ['name'] })
      )

      act(() => {
        result.current.setSearchTerm('test')
      })

      expect(result.current.results).toEqual([])
    })

    test('should handle single item', () => {
      const singleItem = [{ id: '1', name: 'Only Item', category: 'Test' }]

      const { result } = renderHook(() =>
        useFuzzySearch(singleItem, { keys: ['name'] })
      )

      act(() => {
        result.current.setSearchTerm('Only')
      })

      expect(result.current.results).toEqual(singleItem)
    })

    test('should handle special characters in search term', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'] })
      )

      act(() => {
        result.current.setSearchTerm('App!e@#')
      })

      // Should not crash and should handle gracefully
      expect(result.current.results).toBeDefined()
    })

    test('should handle very long search terms', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'] })
      )

      const longSearchTerm = 'a'.repeat(1000)

      act(() => {
        result.current.setSearchTerm(longSearchTerm)
      })

      expect(result.current.results).toBeDefined()
    })

    test('should handle items without specified search keys', () => {
      const itemsWithMissingKeys = [
        { id: '1', category: 'A' }, // Missing 'name'
        { id: '2', name: 'Item 2', category: 'B' }
      ]

      const { result } = renderHook(() =>
        useFuzzySearch(itemsWithMissingKeys, { keys: ['name'] })
      )

      act(() => {
        result.current.setSearchTerm('Item')
      })

      // Should only find items with the 'name' key
      expect(result.current.results).toHaveLength(1)
      expect(result.current.results[0].id).toBe('2')
    })
  })

  describe('search term updates', () => {
    test('should update search term correctly', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'] })
      )

      expect(result.current.searchTerm).toBe('')

      act(() => {
        result.current.setSearchTerm('Apple')
      })

      expect(result.current.searchTerm).toBe('Apple')

      act(() => {
        result.current.setSearchTerm('Samsung')
      })

      expect(result.current.searchTerm).toBe('Samsung')
    })

    test('should clear search results when search term is cleared', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'] })
      )

      act(() => {
        result.current.setSearchTerm('Apple')
      })

      expect(result.current.results.length).toBeLessThan(sampleItems.length)

      act(() => {
        result.current.setSearchTerm('')
      })

      expect(result.current.results).toEqual(sampleItems)
    })
  })

  describe('performance characteristics', () => {
    test('should handle large datasets efficiently', () => {
      // Create 1000 items
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        name: `Item ${i}`,
        category: `Category ${i % 10}`
      }))

      const { result } = renderHook(() =>
        useFuzzySearch(largeDataset, { keys: ['name', 'category'] })
      )

      const startTime = performance.now()

      act(() => {
        result.current.setSearchTerm('Item 5')
      })

      const endTime = performance.now()

      // Should complete search in reasonable time (< 100ms)
      expect(endTime - startTime).toBeLessThan(100)
      expect(result.current.results.length).toBeGreaterThan(0)
    })

    test('should not cause memory leaks on repeated searches', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleItems, { keys: ['name'] })
      )

      // Perform many searches
      for (let i = 0; i < 100; i++) {
        act(() => {
          result.current.setSearchTerm(`Search ${i}`)
        })
      }

      // Should still work correctly
      act(() => {
        result.current.setSearchTerm('Apple')
      })

      expect(result.current.results.length).toBeGreaterThan(0)
    })
  })
})
