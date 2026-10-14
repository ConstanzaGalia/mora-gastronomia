'use client'

import { Pencil } from 'lucide-react'
import { useActionState, useEffect, useRef } from 'react'
import { DeleteButton } from '@/components/delete-button'
import { deleteMembership, endPersonMembership, updatePerson } from '@/lib/actions/people'

export function PersonActions({
  membershipId,
  companyId,
  profileId,
  nombre,
  apellido,
  canEnd,
  canDelete = true,
  next,
}: {
  membershipId: string
  companyId: string
  profileId: string
  nombre: string
  apellido: string
  canEnd: boolean
  canDelete?: boolean
  next: string
}) {
  return (
    <div className="row-actions">
      <EditPersonButton id={profileId} companyId={companyId} nombre={nombre} apellido={apellido} />
      {canEnd && (
        <form action={endPersonMembership}>
          <input type="hidden" name="membership_id" value={membershipId} />
          <input type="hidden" name="company_id" value={companyId} />
          <button className="outline-button" type="submit">Dar de baja</button>
        </form>
      )}
      {canDelete && (
        <DeleteButton
          action={deleteMembership}
          name={`${nombre} ${apellido}`.trim()}
          fields={{ membership_id: membershipId, company_id: companyId, next }}
        />
      )}
    </div>
  )
}

function EditPersonButton({
  id,
  companyId,
  nombre,
  apellido,
}: {
  id: string
  companyId: string
  nombre: string
  apellido: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [state, action, pending] = useActionState(updatePerson, { error: '', saved: false })

  useEffect(() => {
    if (state.saved) dialog.current?.close()
  }, [state])

  return (
    <>
      <button className="outline-button icon-action" type="button" aria-label="Editar" title="Editar" onClick={() => dialog.current?.showModal()}>
        <Pencil size={15} />
      </button>
      <dialog
        ref={dialog}
        className="company-dialog"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close()
        }}
      >
        <div className="dialog-heading">
          <h2>Editar persona</h2>
          <button className="outline-button" type="button" onClick={() => dialog.current?.close()}>Cerrar</button>
        </div>
        <form action={action} className="stack-form">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="company_id" value={companyId} />
          <label className="field">Nombre<input name="nombre" defaultValue={nombre} required /></label>
          <label className="field">Apellido<input name="apellido" defaultValue={apellido} required /></label>
          {state.error && <p className="error-banner">{state.error}</p>}
          <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</button>
        </form>
      </dialog>
    </>
  )
}
