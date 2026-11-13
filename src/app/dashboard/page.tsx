import { useBreadcrumbStore } from '@shared/store'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@shared/ui/breadcrumb'
import { AppSidebar } from '@shared/ui/layout/app-sidebar'
import { ChunkErrorBoundary } from '@shared/ui/layout/ChunkErrorBoundary'
import { RouteLoadingSpinner } from '@shared/ui/layout/RouteLoadingSpinner'
import { Separator } from '@shared/ui/separator'
import { SidebarInset, SidebarTrigger } from '@shared/ui/sidebar/Sidebar'
import { SidebarProvider } from '@shared/ui/sidebar/SidebarProvider'
import { cn } from '@shared/utils'
import React, { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'

// The Page component acts as the main provider of layout for this application
// Child components are loaded underneath the header, via the Outlet component

/** Height of the app header, shared with the sidebar so it can sit below it. */
const HEADER_HEIGHT = '2.5rem'

/**
 * The single top bar of the window: sidebar toggle and breadcrumbs.
 *
 * On macOS the window uses an overlay title bar, so this row is also the drag
 * region and leaves room on the left for the traffic lights. It used to be
 * covered by a separate fixed title bar, which hid the toggle and the
 * breadcrumbs behind an opaque strip. Only the bar itself carries
 * `data-tauri-drag-region`, so the controls inside it stay clickable.
 *
 * The background is solid on purpose: a blurred, translucent bar makes window
 * dragging stutter.
 */
const AppHeader: React.FC = () => {
  const { breadcrumbs } = useBreadcrumbStore()
  const [isMacOS] = useState(() => navigator.platform.includes('Mac'))

  return (
    <header
      data-tauri-drag-region
      className={cn(
        'bg-background border-border z-20 flex h-(--header-height) w-full shrink-0 items-center gap-2 border-b pr-4',
        isMacOS ? 'pl-20' : 'pl-3'
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              <BreadcrumbItem>
                {crumb.href ? (
                  <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}

export const Page: React.FC = () => {
  return (
    <SidebarProvider
      className="h-svh flex-col overflow-hidden"
      style={{ '--header-height': HEADER_HEIGHT } as React.CSSProperties}
    >
      <AppHeader />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" />
        {/* The window never scrolls as a whole: each route scrolls inside this
            region, so a full-height page (Baker) can give its own panels
            independent scrolling. */}
        <SidebarInset className="min-h-0 overflow-hidden">
          {/* Suspense + chunk-error boundary wrap only the routed content (#278),
              so the sidebar navigation and header stay mounted while a lazy route
              chunk loads; only this region shows the spinner or the retry UI. */}
          <div className="min-h-0 flex-1 overflow-y-auto" data-route-scroll-region>
            <ChunkErrorBoundary>
              <Suspense fallback={<RouteLoadingSpinner />}>
                <Outlet />
              </Suspense>
            </ChunkErrorBoundary>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

export default Page
