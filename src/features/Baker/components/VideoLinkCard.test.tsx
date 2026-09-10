/**
 * VideoLinkCard (issue #282, B3)
 *
 * The card's overlay actions. Only the replace action is covered here; the
 * others are exercised through VideoLinksManager's tests.
 */
import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../api', () => ({
  openExternalUrl: vi.fn()
}))

import type { VideoLink } from '../types'
import { VideoLinkCard } from './VideoLinkCard'

const LINK: VideoLink = {
  url: 'https://sproutvideo.com/videos/vid-1',
  sproutVideoId: 'vid-1',
  title: 'WBS - MSc - Managing Change',
  thumbnailUrl: 'https://cdn/poster-a.jpg'
}

const baseProps = {
  videoLink: LINK,
  onRemove: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  canMoveUp: false,
  canMoveDown: false
}

describe('VideoLinkCard - replace action', () => {
  it('b3_1_offers_an_enabled_replace_action_when_the_link_can_be_replaced', () => {
    const onReplaceVideo = vi.fn()
    render(
      <VideoLinkCard {...baseProps} onReplaceVideo={onReplaceVideo} replaceDisabledReason={null} />
    )

    const button = screen.getByRole('button', { name: /replace video/i })
    expect(button).toBeEnabled()
    button.click()
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

    expect(screen.queryByRole('button', { name: /replace video/i })).not.toBeInTheDocument()
  })
})
