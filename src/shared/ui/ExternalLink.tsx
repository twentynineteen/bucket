import { openPath } from '@tauri-apps/plugin-opener'
import React from 'react'

// A custom component to open an external URL in the default browser.
interface ExternalLinkProps {
  url: string
  children: React.ReactNode
}

const ExternalLink: React.FC<ExternalLinkProps> = ({ url, children }) => {
  // onClick handler prevents default navigation and uses Tauri's open API.
  const handleClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    await openPath(url)
  }

  return (
    <a href={url} onClick={handleClick}>
      {children}
    </a>
  )
}

export default ExternalLink
