/**
 * FileInputField Component
 *
 * Reusable file input field with error display.
 */

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FileInputFieldProps {
  id: string
  label: string
  file: File | null
  error?: string
  disabled: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function FileInputField({
  id,
  label,
  file,
  error,
  disabled,
  onChange
}: FileInputFieldProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="file"
        accept=".txt,.docx"
        onChange={onChange}
        disabled={disabled}
      />
      {file && (
        <p className="text-muted-foreground mt-1 text-sm">
          Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
        </p>
      )}
      {error && <p className="text-destructive mt-1 text-sm">{error}</p>}
    </div>
  )
}
