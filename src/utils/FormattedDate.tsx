import React from 'react'

// Helper function to format ISO date string into "hh:mm dd/MM/yyyy"
const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return dateStr // Return original string if invalid date
    }

    // Extract hours and minutes, pad with leading zeros if needed
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')

    // Extract day, month (months are zero-indexed so add 1), and year
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()

    // Construct the formatted string
    return `${hours}:${minutes} ${day}/${month}/${year}`
  } catch {
    return dateStr // Return original string if any error occurs
  }
}

interface FormattedDateProps {
  dateString: string
}

const FormattedDate: React.FC<FormattedDateProps> = ({ dateString }) => {
  return (
    <div className="text-muted-foreground pt-2 text-sm">
      {/* Render the formatted date */}
      Uploaded: {formatDate(dateString)}
    </div>
  )
}

export default FormattedDate
