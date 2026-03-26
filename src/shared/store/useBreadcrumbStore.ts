import { create } from 'zustand'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbState {
  breadcrumbs: BreadcrumbItem[]
  setBreadcrumbs: (items: BreadcrumbItem[]) => void
}

export const useBreadcrumbStore = create<BreadcrumbState>()((set) => ({
  breadcrumbs: [],
  setBreadcrumbs: (items) => set({ breadcrumbs: items })
}))
