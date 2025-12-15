import { Button } from '@components/ui/button'
import React from 'react'

interface TrelloIntegrationButtonProps {
  onClick: () => void
  disabled?: boolean
}

const TrelloIntegrationButton: React.FC<TrelloIntegrationButtonProps> = ({
  onClick,
  disabled = false
}) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size="lg"
      className="bg-info hover:bg-info/90 focus:ring-info/30 font-medium text-white shadow-lg transition-all duration-200 hover:shadow-xl focus:ring-4"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        className="mr-2"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <path d="M7 7h3v9H7zm7 0h3v5h-3z" />
        </g>
      </svg>
      Link to Trello
    </Button>
  )
}

export default TrelloIntegrationButton
