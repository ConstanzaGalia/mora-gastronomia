'use client'

import { useActionState, useEffect, useState } from 'react'
import { useDialogClose } from '@/components/form-dialog'
import { SectorSelect } from '@/components/company-sectors'
import { addPerson, lookupPerson, type PeopleState } from '@/lib/actions/people'
import { businessToday, formatDay } from '@/lib/format'
import type { CompanySector } from '@/lib/sectors'

const initial: PeopleState = { error: '', notice: '', found: null, openSelections: [], needsConfirm: false }

export function PeopleForm({
  companyId,
  canAssignAdmin,
  sectors = [],
}: {
  companyId: string
  canAssignAdmin: boolean
  sectors?: CompanySector[]
}) {
  const close = useDialogClose()
  const [lookup, lookupAction, looking] = useActionState(lookupPerson, initial)
  const [saved, saveAction, saving] = useActionState(addPerson, initial)
  const [dni, setDni] = useState('')
  const state = saved.notice || saved.error || saved.needsConfirm ? saved : lookup

  useEffect(() => {
    if (saved.notice && !saved.needsConfirm && !saved.error) close()
  }, [saved, close])

  return (
    <div className="people-form">
      <form action={lookupAction} className="form-row">
        <input type="hidden" name="started_at" value={businessToday()} />
        <label className="field">DNI<input name="dni" inputMode="numeric" value={dni} onChange={(event) => setDni(event.target.value)} required /></label>
        <button className="outline-button" type="submit" disabled={looking}>{looking ? 'Buscando…' : 'Buscar'}</button>
      </form>
      {state.notice && <p className="success-banner">{state.notice}</p>}
      {state.openSelections.length > 0 && (
        <ul className="plain-list">
          {state.openSelections.map((item) => (
            <li key={`${item.company_name}-${item.service_date}`}>
              {formatDay(item.service_date)} · {item.company_name} · elección abierta, se cancela
            </li>
          ))}
        </ul>
      )}
      <form action={saveAction} className="stack-form">
        <input type="hidden" name="company_id" value={companyId} />
        <input type="hidden" name="dni" value={dni} />
        {state.needsConfirm && <input type="hidden" name="confirm" value="1" />}
        {!state.found && (
          <>
            <label className="field">Nombre<input name="nombre" /></label>
            <label className="field">Apellido<input name="apellido" /></label>
          </>
        )}
        <label className="field">Desde<input type="date" name="started_at" defaultValue={businessToday()} /></label>
        {canAssignAdmin ? (
          <label className="field">Rol
            <select name="role" defaultValue="EMPLOYEE">
              <option value="EMPLOYEE">Empleado</option>
              <option value="COMPANY_ADMIN">Encargado de empresa</option>
            </select>
          </label>
        ) : <input type="hidden" name="role" value="EMPLOYEE" />}
        <SectorSelect sectors={sectors} />
        {canAssignAdmin && (
          <>
            <label className="field">Email del encargado<input name="email" type="email" placeholder="Solo si el rol es encargado" /></label>
            <label className="field">Contraseña del encargado<input name="password" type="password" placeholder="Solo si el rol es encargado" /></label>
          </>
        )}
        {state.error && <p className="error-banner">{state.error}</p>}
        <button className="primary-button" type="submit" disabled={saving || !dni}>
          {saving ? 'Guardando…' : state.needsConfirm ? 'Confirmar pase' : 'Vincular persona'}
        </button>
      </form>
    </div>
  )
}
