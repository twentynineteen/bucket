/**
 * NavUser: the sidebar user menu.
 *
 * Two behaviours are pinned here, both from issue #206.
 *
 * The menu must keep identifying the user. Its display name comes from the
 * `get_username` Tauri command, which is not authentication and survives the
 * removal of the auth surface - so it is asserted through the real query, with
 * only the Tauri boundary mocked.
 *
 * The menu must not offer "Log out". #199 removed the app's authentication
 * entirely, so a control promising to end a session promises something the app
 * cannot do.
 */

import '@testing-library/jest-dom'

import { SidebarContext } from '@shared/ui/use-sidebar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { NavUser } from './nav-user'

// The only mocks are the two Tauri boundaries the menu reads from. Plain
// functions rather than vi.fn: `mockReset` in vite.config.ts wipes a vi.fn's
// implementation before every test after the first, which is how the shared
// setup's getVersion mock ends up returning undefined here.
vi.mock('@tauri-apps/api', () => ({
  core: {
    invoke: async (command: string) => {
      if (command === 'get_username') return 'alice'
      throw new Error(`unexpected command: ${command}`)
    }
  }
}))

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: async () => '9.9.9'
}))

// `user.name` is deliberately capitalised where the invoked username is not, so
// the avatar fallback says which of the two produced it: 'a' means the
// get_username query fed it, 'A' would mean the prop did.
const user = { name: 'Alice Ashford', avatar: '/avatar.jpg' }

const sidebar: React.ContextType<typeof SidebarContext> = {
  state: 'expanded',
  open: true,
  setOpen: vi.fn(),
  openMobile: false,
  setOpenMobile: vi.fn(),
  isMobile: false,
  toggleSidebar: vi.fn()
}

function renderNavUser() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <SidebarContext.Provider value={sidebar}>
          <NavUser user={user} onUpdateClicked={vi.fn()} />
        </SidebarContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

/** Opens the menu and returns once its contents are on screen. */
async function openMenu() {
  const trigger = await screen.findByRole('button', { name: /Alice Ashford/ })
  await userEvent.click(trigger)
  await screen.findByText('Version: 9.9.9')
}

describe('NavUser', () => {
  it('identifies the user, with the avatar initial coming from get_username', async () => {
    renderNavUser()

    expect(
      await screen.findByRole('button', { name: /Alice Ashford/ })
    ).toBeInTheDocument()
    expect(await screen.findByText('a')).toBeInTheDocument()
  })

  it('offers the version and an update check when opened', async () => {
    renderNavUser()
    await openMenu()

    expect(screen.getByText('Version: 9.9.9')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Check for updates' })).toBeInTheDocument()
  })

  it('offers no Log out control', async () => {
    renderNavUser()
    await openMenu()

    expect(screen.queryByText('Log out')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log out' })).not.toBeInTheDocument()
  })
})
