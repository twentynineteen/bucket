import { useState } from 'react'

export function TitleBar() {
  // Initialize directly - no need for useEffect since navigator is synchronous
  const [isMacOS] = useState(() => navigator.platform.includes('Mac'))

  // Only render on macOS with overlay titlebar
  if (!isMacOS) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 h-14 z-50 flex items-center px-4 bg-background border-b border-border/50"
      style={{
        paddingLeft: '80px',
        willChange: 'transform'
      }}
      data-tauri-drag-region
    >
      {/* Custom title bar content */}
      <div
        className="flex items-center gap-2 text-sm font-medium text-foreground/70 pl-2"
        style={{ marginTop: '-12px' }}
        data-tauri-drag-region
      >
        <span data-tauri-drag-region>Bucket</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" data-tauri-drag-region />

      {/* Optional: Custom controls can be added here */}
      <div className="flex items-center gap-2" data-tauri-drag-region>
        {/* Add custom controls here if needed */}
      </div>
    </div>
  )
}
