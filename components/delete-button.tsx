'use client'

import { Trash2 } from 'lucide-react'

export function DeleteButton({
  action,
  fields,
  name,
  label = 'Eliminar',
}: {
  action: (formData: FormData) => void | Promise<void>
  fields: Record<string, string>
  name: string
  label?: string
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm(`¿Eliminar ${name}? Esta acción no se puede deshacer.`)) event.preventDefault()
      }}
    >
      {Object.entries(fields).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <button className="outline-button icon-action danger" type="submit" aria-label={label} title={label}>
        <Trash2 size={15} />
      </button>
    </form>
  )
}
