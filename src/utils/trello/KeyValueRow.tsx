import React from 'react'

interface Props {
  label: string
  value: React.ReactNode
}

const KeyValueRow: React.FC<Props> = ({ label, value }) => (
  <p>
    <span className="text-foreground font-medium">{label}:</span>{' '}
    <span className="text-muted-foreground">{value}</span>
  </p>
)

export default KeyValueRow
