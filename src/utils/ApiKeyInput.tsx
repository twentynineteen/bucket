import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input' // Adjust this import if your Input component is located elsewhere.
import React, { useState } from 'react'

type Props = {
  apiKey: string
  setApiKey: React.Dispatch<React.SetStateAction<string>>
  onSave: () => void // Callback to save the API key
  id?: string // Optional ID for label association
  inputType?: 'text' | 'password' // Allow specifying input type (default: password for API keys)
  placeholder?: string // Optional custom placeholder
}

const ApiKeyInput: React.FC<Props> = ({
  apiKey,
  setApiKey,
  onSave,
  id,
  inputType = 'password',
  placeholder = 'Enter your API key...'
}) => {
  // State to track whether the API key should be visible
  const [showApiKey, setShowApiKey] = useState(false)

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {/* Input field with dynamic type based on showApiKey */}
      <Input
        id={id}
        type={inputType === 'text' ? 'text' : showApiKey ? 'text' : 'password'}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1 }}
      />
      {/* Button to toggle visibility */}
      <Button
        onClick={() => setShowApiKey((prev) => !prev)}
        style={{ marginLeft: '8px' }}
      >
        {showApiKey ? 'Hide' : 'Show'}
      </Button>
      {/* Button to save the API key */}
      <Button onClick={onSave} style={{ marginLeft: '8px' }}>
        Save
      </Button>
    </div>
  )
}

export default ApiKeyInput
