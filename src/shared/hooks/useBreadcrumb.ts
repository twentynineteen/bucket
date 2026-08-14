import { CACHE } from '@shared/constants'
import { queryKeys, createQueryOptions } from '@shared/lib'
import { useBreadcrumbStore } from '@shared/store'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbData {
  path: string
  items: Array<{ name: string; url: string }>
  updatedAt: string
}

export const useBreadcrumb = (items: BreadcrumbItem[]) => {
  const setBreadcrumbs = useBreadcrumbStore((state) => state.setBreadcrumbs)
  const queryClient = useQueryClient()

  /**
   * Both of these must be keyed on **content**, not on identity, because both
   * are dependencies of the write below and a write triggers a render.
   *
   * `queryKeys.user.breadcrumb()` allocates a new array on every call, and
   * every caller writes its items array inline, so before this the write ran on
   * every render, and each write - `setQueryData` with a fresh `updatedAt`, and
   * a Zustand `set` the layout subscribes to - re-rendered the tree, which ran
   * the write again. An idle Build Project screen sat at ~570 renders per
   * second, and the sidebar's vibrancy effect turned each one into two Tauri
   * IPC calls. See issue #228.
   */
  const queryKey = useMemo(() => queryKeys.user.breadcrumb(), [])
  const itemsSignature = JSON.stringify(items)
  const stableItems = useMemo(
    () => JSON.parse(itemsSignature) as BreadcrumbItem[],
    [itemsSignature]
  )

  // Cache the breadcrumb path in React Query
  const { data } = useQuery(
    createQueryOptions(
      queryKey,
      async (): Promise<BreadcrumbData> => {
        // Convert items to breadcrumb data format
        const path = items.map((item) => item.label).join(' > ')
        const breadcrumbItems = items.map((item) => ({
          name: item.label,
          url: item.href || '#'
        }))

        return {
          path,
          items: breadcrumbItems,
          updatedAt: new Date().toISOString()
        }
      },
      'STATIC', // Breadcrumb data is relatively stable
      {
        staleTime: CACHE.STANDARD, // 5 minutes
        gcTime: CACHE.GC_MEDIUM, // 10 minutes
        refetchOnWindowFocus: false
      }
    )
  )

  const updateBreadcrumbs = useCallback(() => {
    // Update both React Query cache and Zustand store
    const path = stableItems.map((item) => item.label).join(' > ')
    const breadcrumbItems = stableItems.map((item) => ({
      name: item.label,
      url: item.href || '#'
    }))

    const breadcrumbData: BreadcrumbData = {
      path,
      items: breadcrumbItems,
      updatedAt: new Date().toISOString()
    }

    queryClient.setQueryData(queryKey, breadcrumbData)
    setBreadcrumbs(stableItems) // Maintain Zustand store compatibility
  }, [setBreadcrumbs, stableItems, queryClient, queryKey])

  useEffect(() => {
    updateBreadcrumbs()
  }, [updateBreadcrumbs])

  // Return breadcrumb data for components that might need it
  return {
    breadcrumbData: data,
    updateBreadcrumbs
  }
}
