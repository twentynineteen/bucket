/**
 * Internal TrelloCardMembers component
 * Not exported from barrel - used internally by Trello components
 */

import { useQuery } from '@tanstack/react-query'
import React from 'react'

import { fetchCardMembers } from '../api'
import type { TrelloMember } from '../types'

const TrelloCardMembers: React.FC<{
  cardId: string
  apiKey: string
  token: string
}> = ({ cardId, apiKey, token }) => {
  const {
    data: members,
    error,
    isLoading
  } = useQuery({
    queryKey: ['trelloCardMembers', cardId],
    queryFn: () => fetchCardMembers(cardId, apiKey, token)
  })

  if (isLoading) return <p>Loading members...</p>
  if (error) return <p>Error loading members: {(error as Error).message}</p>

  return (
    <ul>
      {(members as TrelloMember[]).map((member) => (
        <li key={member.id}>{member.username}</li>
      ))}
    </ul>
  )
}

export default TrelloCardMembers
