// Barrel export file for sidebar components
// This file re-exports all sidebar components from their individual files
// to maintain backward compatibility with existing imports

export { SidebarProvider } from './sidebar/SidebarProvider'
export { Sidebar, SidebarTrigger, SidebarRail, SidebarInset } from './sidebar/Sidebar'
export {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton
} from './sidebar/SidebarMenu'
export {
  SidebarInput,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent
} from './sidebar/SidebarLayout'

// Re-export useSidebar hook for convenience
export { useSidebar } from './use-sidebar'
