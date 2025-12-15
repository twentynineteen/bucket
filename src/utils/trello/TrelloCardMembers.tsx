import React from 'react'

import { useTrelloCardMembers } from '../TrelloCards' // adjust path as needed

const TrelloCardMembers: React.FC<{ cardId: string; apiKey: string; token: string }> = ({
  cardId,
  apiKey,
  token
}) => {
  const { data: members, error, isLoading } = useTrelloCardMembers(cardId, apiKey, token)

  if (isLoading) return <p>Loading members...</p>
  if (error) return <p>Error loading members: {error.message}</p>

  return (
    <ul>
      {members.map((member) => (
        <li key={member.id}>{member.username}</li>
      ))}
    </ul>
  )
}

export default TrelloCardMembers
