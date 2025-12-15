import { Avatar, AvatarFallback, AvatarImage } from '@components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@components/ui/sidebar'
import { useSidebar } from '@components/ui/use-sidebar'
import { CACHE } from '@constants/timing'
import { queryKeys } from '@lib/query-keys'
import { createQueryError, createQueryOptions, shouldRetry } from '@lib/query-utils'
import { useQuery } from '@tanstack/react-query'
import { core } from '@tauri-apps/api'
import { getVersion } from '@tauri-apps/api/app'
import { ChevronsUpDown, LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'

type Props = {
  user: {
    name: string
    avatar: string
  }
  onLogout: () => void
  onUpdateClicked: () => void
  // isLoading: boolean
}

export function NavUser({ user, onLogout, onUpdateClicked }: Props) {
  const { isMobile } = useSidebar()

  // Use React Query for app version fetching
  const { data: version } = useQuery({
    ...createQueryOptions(
      queryKeys.user.profile(),
      async () => {
        try {
          return await getVersion()
        } catch (error) {
          throw createQueryError(`Failed to get app version: ${error}`, 'SYSTEM_INFO')
        }
      },
      'STATIC',
      {
        staleTime: CACHE.MEDIUM, // 10 minutes - version doesn't change often
        gcTime: CACHE.GC_EXTENDED, // Keep cached for 30 minutes
        retry: (failureCount, error) => shouldRetry(error, failureCount, 'system')
      }
    )
  })

  // Use React Query for username fetching
  const { data: username } = useQuery({
    ...createQueryOptions(
      queryKeys.user.authentication(),
      async () => {
        try {
          return await core.invoke<string>('get_username')
        } catch (error) {
          throw createQueryError(`Failed to fetch username: ${error}`, 'AUTHENTICATION')
        }
      },
      'STATIC',
      {
        staleTime: CACHE.STANDARD, // 5 minutes - username rarely changes
        gcTime: CACHE.GC_LONG, // Keep cached for 15 minutes
        retry: (failureCount, error) => shouldRetry(error, failureCount, 'auth')
      }
    )
  })

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {(typeof username === 'string' ? username.charAt(0) : null) ||
                    user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                {/* <span className="truncate text-xs">{user.email}</span> */}
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {(typeof username === 'string' ? username.charAt(0) : null) ||
                      user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  {/* <span className="truncate text-xs">{user.email}</span> */}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                Version: {version || 'Loading...'}
                {/* {isLoading ? 'Checking for updates...' : 'Check for updates'} */}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <div className="flex items-center space-x-2">
                  <Link to="#" onClick={onUpdateClicked}>
                    {/* <Bell size={16} />  */}
                    Check for updates
                    {/* {isLoading ? 'Checking for updates...' : 'Check for updates'} */}
                  </Link>
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut />
              <Link to="#" onClick={onLogout}>
                Log out
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
