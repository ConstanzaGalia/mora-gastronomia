'use client'

import { FormDialog } from '@/components/form-dialog'
import { cancelEmployeeSelection } from '@/lib/actions/choices'

export function CancelMenuButton({
  selectionId,
  personName,
  back,
}: {
  selectionId: string
  personName: string
  back: string
}) {
  return (
    <FormDialog
      title="Anular menú"
      trigger="Anular menú"
      triggerClassName="outline-button"
      action={cancelEmployeeSelection}
    >
      <input type="hidden" name="selection_id" value={selectionId} />
      <input type="hidden" name="back" value={back} />
      <p>Vas a sacar a {personName} de producción y reportes de ese día.</p>
      <button className="primary-button" type="submit">Sí, anular menú</button>
    </FormDialog>
  )
}
