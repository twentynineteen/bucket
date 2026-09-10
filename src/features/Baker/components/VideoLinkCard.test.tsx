/**
 * VideoLinkCard
 *
 * The card's rendering and overlay actions. Consolidated here from
 * tests/unit/components/VideoLinkCard.test.tsx (a legacy location) when the
 * replace action was added (#282); the poster frame tests are #141's, the
 * replace tests are #282's B3. Three React.memo tests that asserted nothing a
 * user could see were dropped in the move.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api', () => ({
  openExternalUrl: vi.fn()
}))

import { openExternalUrl } from '../api'
import type { VideoLink } from '../types'
import { VideoLinkCard } from './VideoLinkCard'

const LINK: VideoLink = {
  url: 'https://sproutvideo.com/videos/abc123',
  title: 'Project Alpha - Final Edit',
  sproutVideoId: 'abc123',
  uploadDate: '2024-01-15T10:30:00Z',
  thumbnailUrl: 'https://sproutvideo.com/thumbnails/abc123.jpg',
  sourceRenderFile: 'project_alpha_final.mp4'
}

const baseProps = {
  videoLink: LINK,
  onRemove: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  canMoveUp: true,
  canMoveDown: true
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('VideoLinkCard - rendering', () => {
  it('renders the title, id, upload date and source file', () => {
    render(<VideoLinkCard {...baseProps} />)

    expect(screen.getByText('Project Alpha - Final Edit')).toBeInTheDocument()
    expect(screen.getByText(/ID: abc123/i)).toBeInTheDocument()
    // "Jan 15, 2024" in the card's en-US format
    expect(screen.getByText(/Uploaded: Jan 15, 2024/i)).toBeInTheDocument()
    expect(screen.getByText(/Source: project_alpha_final.mp4/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /open in sprout video/i })
    ).toBeInTheDocument()
  })

  it('omits the optional rows when the link has no id, date or source', () => {
    // Omitted, not null: the Rust structs use skip_serializing_if, so an
    // absent field never reaches the frontend as null (#210).
    render(
      <VideoLinkCard
        {...baseProps}
        videoLink={{
          url: 'https://sproutvideo.com/videos/xyz789',
          title: 'Minimal Video'
        }}
      />
    )

    expect(screen.getByText('Minimal Video')).toBeInTheDocument()
    expect(screen.queryByText(/ID:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Uploaded:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Source:/i)).not.toBeInTheDocument()
  })

  it('shows the thumbnail verbatim when nothing has been refreshed', () => {
    render(<VideoLinkCard {...baseProps} />)

    expect(screen.getByAltText('Project Alpha - Final Edit')).toHaveAttribute(
      'src',
      'https://sproutvideo.com/thumbnails/abc123.jpg'
    )
  })

  it('shows a placeholder instead of an image when there is no thumbnail', () => {
    const { container } = render(
      <VideoLinkCard {...baseProps} videoLink={{ ...LINK, thumbnailUrl: undefined }} />
    )

    expect(container.querySelector('.bg-muted')).toBeInTheDocument()
    expect(screen.queryByAltText('Project Alpha - Final Edit')).not.toBeInTheDocument()
  })

  it('cache-busts a refreshed thumbnail, respecting an existing query string (#141 B1.3)', () => {
    const { rerender } = render(
      <VideoLinkCard {...baseProps} thumbnailCacheKey={1717171717} />
    )

    expect(screen.getByAltText('Project Alpha - Final Edit')).toHaveAttribute(
      'src',
      'https://sproutvideo.com/thumbnails/abc123.jpg?v=1717171717'
    )

    rerender(
      <VideoLinkCard
        {...baseProps}
        videoLink={{ ...LINK, thumbnailUrl: `${LINK.thumbnailUrl}?size=large` }}
        thumbnailCacheKey={1717171717}
      />
    )

    expect(screen.getByAltText('Project Alpha - Final Edit')).toHaveAttribute(
      'src',
      'https://sproutvideo.com/thumbnails/abc123.jpg?size=large&v=1717171717'
    )
  })

  it('uses no backdrop-blur anywhere: it is expensive while the window is dragged', () => {
    const { container } = render(<VideoLinkCard {...baseProps} />)

    for (const element of container.querySelectorAll('*')) {
      expect(element.className).not.toContain('backdrop-blur')
    }
  })
})

describe('VideoLinkCard - actions', () => {
  it('opens the video in the browser', async () => {
    const user = userEvent.setup()
    render(<VideoLinkCard {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /open in sprout video/i }))

    expect(openExternalUrl).toHaveBeenCalledWith('https://sproutvideo.com/videos/abc123')
  })

  it('reports move up, respects a disabled move down, and reports remove', async () => {
    const user = userEvent.setup()
    const onMoveUp = vi.fn()
    const onRemove = vi.fn()
    render(
      <VideoLinkCard
        {...baseProps}
        onMoveUp={onMoveUp}
        onRemove={onRemove}
        canMoveDown={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /move up/i }))
    expect(onMoveUp).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /move down/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /remove video/i }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})

describe('VideoLinkCard - poster frame action (#141)', () => {
  it('b1_1_b1_2_offers_the_action_in_the_overlay_and_reports_it_without_a_dialog', async () => {
    const user = userEvent.setup()
    const onSetPosterFrame = vi.fn()
    render(<VideoLinkCard {...baseProps} onSetPosterFrame={onSetPosterFrame} />)

    const action = screen.getByRole('button', { name: /set poster frame/i })
    expect(action).toBeEnabled()
    // Sits with move up/down/remove rather than in the card body
    expect(screen.getByRole('button', { name: /move up/i }).parentElement).toBe(
      action.parentElement
    )

    await user.click(action)

    expect(onSetPosterFrame).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('b2_3_disables_the_action_and_explains_when_no_sprout_id_can_be_resolved', () => {
    render(
      <VideoLinkCard
        {...baseProps}
        videoLink={{ ...LINK, sproutVideoId: undefined, url: 'https://example.com/x' }}
        onSetPosterFrame={vi.fn()}
        posterFrameDisabledReason="No Sprout video ID could be determined from this link."
      />
    )

    const action = screen.getByRole('button', { name: /set poster frame/i })
    expect(action).toBeDisabled()
    expect(action.getAttribute('title')).toContain('No Sprout video ID')
  })
})

describe('VideoLinkCard - replace action (#282)', () => {
  it('b3_1_offers_an_enabled_replace_action_when_the_link_can_be_replaced', async () => {
    const user = userEvent.setup()
    const onReplaceVideo = vi.fn()
    render(
      <VideoLinkCard
        {...baseProps}
        onReplaceVideo={onReplaceVideo}
        replaceDisabledReason={null}
      />
    )

    const button = screen.getByRole('button', { name: /replace video/i })
    expect(button).toBeEnabled()
    await user.click(button)
    expect(onReplaceVideo).toHaveBeenCalledTimes(1)
  })

  it('b3_2_b3_3_disables_the_action_and_shows_the_reason_as_its_tooltip', () => {
    render(
      <VideoLinkCard
        {...baseProps}
        onReplaceVideo={vi.fn()}
        replaceDisabledReason="No Sprout video ID could be determined from this link."
      />
    )

    const button = screen.getByRole('button', { name: /replace video/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute(
      'title',
      'No Sprout video ID could be determined from this link.'
    )
  })

  it('renders no replace action when the surface does not offer one', () => {
    render(<VideoLinkCard {...baseProps} />)

    expect(
      screen.queryByRole('button', { name: /replace video/i })
    ).not.toBeInTheDocument()
  })
})
