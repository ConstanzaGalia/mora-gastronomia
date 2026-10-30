'use client'

import { useActionState, useEffect, useState } from 'react'
import { useDialogClose } from '@/components/form-dialog'
import { SectorSelect } from '@/components/company-sectors'
import { addPerson, lookupPerson, type PeopleState } from '@/lib/actions/people'
import { businessToday } from '@/lib/format'
import type { CompanySector } from '@/lib/sectors'

const initial: PeopleState = { error: '', notice: '', found: null, otherCompanies: [] }

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
  const state = saved.notice || saved.error || saved.otherCompanies.length ? saved : lookup
  const others = state.otherCompanies
  const otherNames = others.map((company) => company.company_name)
  const otherLabel = otherNames.length <= 1
    ? otherNames[0] ?? 'la otra empresa'
    : otherNames.length === 2
      ? `${otherNames[0]} y ${otherNames[1]}`
      : `${otherNames.slice(0, -1).join(', ')} y ${otherNames[otherNames.length - 1]}`

  useEffect(() => {
    if (saved.notice && !saved.error) close()
  }, [saved, close])

  return (
    <div className="people-form">
      <form action={lookupAction} className="form-row">
        <input type="hidden" name="company_id" value={companyId} />
        <input type="hidden" name="started_at" value={businessToday()} />
        <label className="field">DNI<input name="dni" inputMode="numeric" value={dni} onChange={(event) => setDni(event.target.value)} required /></label>
        <button className="outline-button" type="submit" disabled={looking}>{looking ? 'Buscando…' : 'Buscar'}</button>
      </form>
      {state.notice && <p className="success-banner">{state.notice}</p>}
      <form action={saveAction} className="stack-form">
        <input type="hidden" name="company_id" value={companyId} />
        <input type="hidden" name="dni" value={dni} />
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
        {others.length > 0 && (
          <fieldset className="people-other-companies">
            <legend>Ya pide en {otherLabel}</legend>
            <p className="muted">Empresas distintas que comparten empleados. Elegí si queda en las dos o solo en esta.</p>
            <label className="combo-option">
              <input type="radio" name="other_memberships" value="keep" defaultChecked />
              Mantener las dos activas
            </label>
            <label className="combo-option">
              <input type="radio" name="other_memberships" value="close" />
              Cerrar {otherLabel}
            </label>
          </fieldset>
        )}
        {canAssignAdmin && (
          <>
            <label className="field">Email del encargado<input name="email" type="email" placeholder="Solo si el rol es encargado" /></label>
            <label className="field">Contraseña del encargado<input name="password" type="password" placeholder="Solo si el rol es encargado" /></label>
          </>
        )}
        {state.error && <p className="error-banner">{state.error}</p>}
        <button className="primary-button" type="submit" disabled={saving || !dni}>
          {saving ? 'Guardando…' : 'Vincular persona'}
        </button>
      </form>
    </div>
  )
}
