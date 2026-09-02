import { ChunkErrorBoundary } from '@shared/ui/layout/ChunkErrorBoundary'
import { RouteLoadingSpinner } from '@shared/ui/layout/RouteLoadingSpinner'
import { AppSidebar } from '@shared/ui/layout/app-sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@shared/ui/breadcrumb'
import { Separator } from '@shared/ui/separator'
import { SidebarInset, SidebarTrigger } from '@shared/ui/sidebar/Sidebar'
import { SidebarProvider } from '@shared/ui/sidebar/SidebarProvider'
import { useBreadcrumbStore } from '@shared/store'
import React, { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

// The Page component acts as the main provider of layout for this application
// Child components are loaded underneath the header, via the Outlet component

export const Page: React.FC = () => {
  const { breadcrumbs } = useBreadcrumbStore()
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
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
          </div>
        </header>
        {/* Suspense + chunk-error boundary wrap only the routed content (#278),
            so the sidebar navigation and header stay mounted while a lazy route
            chunk loads; only this region shows the spinner or the retry UI. */}
        <ChunkErrorBoundary>
          <Suspense fallback={<RouteLoadingSpinner />}>
            <Outlet />
          </Suspense>
        </ChunkErrorBoundary>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Page
