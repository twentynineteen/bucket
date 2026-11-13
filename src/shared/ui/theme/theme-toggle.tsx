import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@shared/ui/sidebar/SidebarMenu'
import { Palette } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function ThemeToggle() {
  const navigate = useNavigate()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() => navigate('/settings/general')}
          tooltip="Customise theme in Settings"
          className="text-muted-foreground text-xs"
        >
          <Palette className="h-4 w-4" />
          <span>Customise</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
