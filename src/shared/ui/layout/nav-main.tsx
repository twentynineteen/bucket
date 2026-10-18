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
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

/**
 * Split a sub-item URL into pathname and hash so we can match against the
 * router location. Query strings are stripped from the pathname and ignored
 * for matching purposes - none of the real sidebar URLs use them.
 */
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

/** Check whether any sub-item's pathname matches the given pathname. */
function groupMatchesPathname(
  items: { url: string }[] | undefined,
  pathname: string
): boolean {
  return items?.some(sub => splitUrl(sub.url).pathname === pathname) ?? false
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

  // Track user-initiated open/close toggles separately from route-derived
  // state. The user's overrides are scoped to a pathname: when the
  // pathname changes we clear the override for the newly matched group
  // so it auto-opens, while keeping other overrides intact.
  const [manualToggles, setManualToggles] = useState<Record<string, boolean>>({})
  const [prevPathname, setPrevPathname] = useState(location.pathname)

  // "Update state during render" pattern (React docs - adjusting state
  // from props). No effect, no ref access.
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname)
    // Clear the manual override for the group the route now matches,
    // so it opens automatically. Other overrides are preserved.
    for (const item of items) {
      if (groupMatchesPathname(item.items, location.pathname)) {
        if (item.title in manualToggles) {
          const next = { ...manualToggles }
          delete next[item.title]
          setManualToggles(next)
        }
        break
      }
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
      <SidebarMenu>
        {items.map(item => {
          const groupIsActive = groupMatchesPathname(item.items, location.pathname)

          // A group is open when:
          // - the user explicitly opened it (manual override), OR
          // - the route matches one of its sub-items and the user
          //   has not explicitly closed it
          const isOpen =
            item.title in manualToggles ? manualToggles[item.title] : groupIsActive

          return (
            <Collapsible
              key={item.title}
              asChild
              open={isOpen}
              onOpenChange={open => {
                setManualToggles(prev => ({ ...prev, [item.title]: open }))
              }}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.title}
                    asChild={isCollapsed}
                    isActive={groupIsActive}
                  >
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
