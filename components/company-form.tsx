'use client'

import { useActionState, useRef, useState } from 'react'
import { saveCompany } from '@/lib/actions/companies'
import { DEFAULT_SELECTION_CLOSE, selectionCloseInput } from '@/lib/format'

export function CompanyForm({
  company,
  layout = 'stack',
}: {
  company?: {
    id: string
    nombre_comercial: string
    razon_social: string | null
    cuit: string | null
    active: boolean
    selection_close_time?: string
  }
  layout?: 'stack' | 'grid'
}) {
  const initialClose = selectionCloseInput(company?.selection_close_time)
  const [special, setSpecial] = useState(initialClose !== DEFAULT_SELECTION_CLOSE)
  const [state, action, pending] = useActionState(saveCompany, { error: '' })
  return (
    <form action={action} className={layout === 'grid' ? 'company-fields' : 'stack-form'}>
      {company && <input type="hidden" name="id" value={company.id} />}
      <label className="field">Nombre comercial<input name="nombre_comercial" defaultValue={company?.nombre_comercial ?? ''} required /></label>
      <label className="field">Razón social<input name="razon_social" defaultValue={company?.razon_social ?? ''} /></label>
      <label className="field">CUIT<input name="cuit" inputMode="numeric" defaultValue={company?.cuit ?? ''} placeholder="11 dígitos, sin guiones" /></label>
      <label className="check-line"><input type="checkbox" name="active" defaultChecked={company?.active ?? true} /> Activa</label>
      <div className="close-time">
        <input type="hidden" name="special_close" value={special ? 'on' : ''} />
        <label className="check-line">
          <input
            type="checkbox"
            checked={special}
            onChange={(event) => setSpecial(event.target.checked)}
          />
          Cierre especial
        </label>
        {special ? (
          <label className="field">
            Hora de cierre
            <input type="time" name="selection_close_time" defaultValue={initialClose === DEFAULT_SELECTION_CLOSE ? '13:00' : initialClose} required />
          </label>
        ) : (
          <input type="hidden" name="selection_close_time" value={DEFAULT_SELECTION_CLOSE} />
        )}
        <p className="muted">Hasta qué hora del día anterior pueden elegir. El lunes cierra el sábado. No es la extensión de 7:00 a 9:00.</p>
      </div>
      {state.error && <p className="error-banner">{state.error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Guardando…' : company ? 'Guardar empresa' : 'Crear empresa'}</button>
    </form>
  )
}

export function NewCompanyButton() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [formKey, setFormKey] = useState(0)

  function open() {
    setFormKey((value) => value + 1)
    dialog.current?.showModal()
  }

  return (
    <>
      <button className="primary-button" type="button" onClick={open}>Agregar empresa</button>
      <dialog
        ref={dialog}
        className="company-dialog"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close()
        }}
      >
        <div className="dialog-heading">
          <h2>Nueva empresa</h2>
          <button className="outline-button" type="button" onClick={() => dialog.current?.close()}>Cerrar</button>
        </div>
        <CompanyForm key={formKey} />
      </dialog>
    </>
  )
}
