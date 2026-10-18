import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@shared/ui/collapsible'
import { SidebarGroup, SidebarGroupLabel } from '@shared/ui/sidebar/SidebarLayout'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from '@shared/ui/sidebar/SidebarMenu'
import { useSidebar } from '@shared/ui/use-sidebar'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

/** Split a sub-item URL into pathname and hash so we can match against the route. */
function splitUrl(url: string): { pathname: string; hash: string } {
  const hashIdx = url.indexOf('#')
  const queryIdx = url.indexOf('?')
  if (hashIdx === -1 && queryIdx === -1) return { pathname: url, hash: '' }
  // Determine where the pathname ends (first of ? or #)
  const end =
    hashIdx === -1 ? queryIdx : queryIdx === -1 ? hashIdx : Math.min(hashIdx, queryIdx)
  return {
    pathname: url.slice(0, end),
    hash: hashIdx === -1 ? '' : url.slice(hashIdx)
  }
}

export function NavMain({
  items
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const location = useLocation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
      <SidebarMenu>
        {items.map(item => {
          const groupIsActive =
            item.items?.some(sub => splitUrl(sub.url).pathname === location.pathname) ??
            false

          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={groupIsActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} asChild={isCollapsed}>
                    {isCollapsed ? (
                      <Link to={item.url}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                      </Link>
                    ) : (
                      <>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </>
                    )}
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map(subItem => {
                      const { pathname, hash } = splitUrl(subItem.url)
                      const isSubActive =
                        location.pathname === pathname && location.hash === hash

                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={isSubActive}>
                            <Link to={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
