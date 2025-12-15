import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@components/ui/sidebar'
import { Palette } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function ThemeToggle() {
  const navigate = useNavigate()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() => navigate('/settings/general')}
          tooltip="Customize theme in Settings"
          className="text-muted-foreground text-xs"
        >
          <Palette className="h-4 w-4" />
          <span>Customize</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
