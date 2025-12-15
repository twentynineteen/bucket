import { Button } from '@components/ui/button'
import React, { useState } from 'react'

import { logger } from './logger'

interface EmbedCodeInputProps {
  embedCode: string
}

const EmbedCodeInput: React.FC<EmbedCodeInputProps> = ({ embedCode }) => {
  // State to indicate if the code was successfully copied
  const [copied, setCopied] = useState(false)

  // Function to copy the embed code to clipboard using the Clipboard API
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      // Reset the copied indicator after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      logger.error('Failed to copy text:', error)
    }
  }

  return (
    <div className="pt-4">
      {/* Display the embed code in a read-only textarea */}
      <textarea
        readOnly
        value={embedCode}
        style={{
          width: '350px',
          minHeight: '100px',
          fontFamily: 'monospace',
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
      />
      {/* Button to copy the embed code */}
      <Button
        onClick={handleCopy}
        style={{ marginTop: '8px' }}
        className="drop-shadow-lg"
      >
        {copied ? 'Copied!' : 'Copy Embed to Clipboard'}
      </Button>
    </div>
  )
}

export default EmbedCodeInput
