import { NavMain } from './nav-main'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import { ThemeToggle } from '@shared/ui/theme/theme-toggle'
import { Sidebar, SidebarRail } from '@shared/ui/sidebar/Sidebar'
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader
} from '@shared/ui/sidebar/SidebarLayout'
import { UpdateDialog } from './UpdateDialog'
import { useMacOSEffects } from '@shared/hooks/useMacOSEffects'
import { useUpdateManager } from '@shared/hooks/useUpdateManager'
import { useUsername } from '@shared/hooks'
import {
  Clapperboard,
  FileText,
  HardDriveUpload,
  Puzzle,
  Save,
  Settings
} from 'lucide-react'
import * as React from 'react'

// This is sample data. User data is located just before function return statement
const data = {
  teams: [
    {
      name: 'Media Team',
      logo: Clapperboard,
      plan: 'Teaching and Learning Enhancement'
    }
  ],
  navMain: [
    {
      title: 'Ingest footage',
      url: '/ingest/build',
      icon: Save,
      isActive: true,
      items: [
        {
          title: 'Build a project',
          url: '/ingest/build'
        },
        {
          title: 'Baker',
          url: '/ingest/baker'
        }
      ]
    },
    {
      title: 'AI tools',
      url: '/ai-tools/script-formatter',
      icon: FileText,
      isActive: false,
      items: [
        {
          title: 'Autocue script formatter',
          url: '/ai-tools/script-formatter'
        },
        {
          title: 'Example embeddings',
          url: '/ai-tools/example-embeddings'
        }
      ]
    },
    {
      title: 'Upload content',
      url: '/upload/sprout',
      icon: HardDriveUpload,
      isActive: false,
      items: [
        {
          title: 'Sprout video',
          url: '/upload/sprout'
        },
        {
          title: 'Posterframe',
          url: '/upload/posterframe'
        },
        {
          title: 'Trello',
          url: '/upload/trello'
        },
        {
          title: 'Transcription',
          url: '/upload/otter'
        }
      ]
    },
    {
      title: 'Premiere Plugins',
      url: '/premiere/premiere-plugins',
      icon: Puzzle,
      isActive: false,
      items: [
        {
          title: 'Premiere Plugin Manager',
          url: '/premiere/premiere-plugins'
        }
      ]
    },
    {
      title: 'Settings',
      url: '/settings/general',
      icon: Settings,
      isActive: false,
      items: [
        {
          title: 'General',
          url: '/settings/general'
        },
        {
          title: 'AI Models',
          url: '/settings/general#ai-models'
        },
        {
          title: 'Appearance',
          url: '/settings/general#appearance'
        },
        {
          title: 'Backgrounds',
          url: '/settings/general#backgrounds'
        },
        {
          title: 'SproutVideo',
          url: '/settings/general#sproutvideo'
        },
        {
          title: 'Trello',
          url: '/settings/general#trello'
        }
      ]
    }
  ]
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onLogout?: () => void
}

export function AppSidebar({ onLogout, ...props }: AppSidebarProps) {
  const { data: username } = useUsername()

  // Apply macOS sidebar vibrancy effect
  useMacOSEffects({ effects: ['Sidebar'] })

  // Create the update manager hook instance.
  const { dialogState, onUpdate, onCancel, mutate } = useUpdateManager()

  // Callback for when the update button is clicked.
  const onUpdateClicked = React.useCallback(() => {
    // Set `onUserClick` to true to show feedback when no update is available.
    mutate({ onUserClick: true })
  }, [mutate])

  const user = {
    name: username || 'Unknown User',
    avatar: '/filepath/file.jpg'
  }

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <TeamSwitcher teams={data.teams} />
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={data.navMain} />
        </SidebarContent>
        <SidebarFooter>
          <ThemeToggle />
          <NavUser user={user} onLogout={onLogout} onUpdateClicked={onUpdateClicked} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <UpdateDialog
        open={dialogState.open}
        currentVersion={dialogState.currentVersion}
        latestVersion={dialogState.latestVersion}
        releaseNotes={dialogState.releaseNotes}
        onUpdate={onUpdate}
        onCancel={onCancel}
      />
    </>
  )
}
