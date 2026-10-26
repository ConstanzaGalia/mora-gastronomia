'use client'

import { ArrowDown, ArrowUp, Pencil } from 'lucide-react'
import { useActionState, useEffect, useRef, useState } from 'react'
import { DeleteButton } from '@/components/delete-button'
import { FormDialog } from '@/components/form-dialog'
import { deleteSector, moveSector, saveSector, updateSector } from '@/lib/actions/companies'
import type { CompanySector } from '@/lib/sectors'

export function CompanySectors({ companyId, sectors }: { companyId: string; sectors: CompanySector[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Sectores</h2>
          <p className="muted">Si la empresa tiene sectores, el informe de comensales sale agrupado. El encargado no arma esta lista.</p>
        </div>
        <FormDialog title="Sectores" trigger="Editar sectores" triggerClassName="outline-button">
          <p className="muted">El orden de esta lista es el del informe. Quien no tenga sector aparece al final, en Sin sector.</p>
          <SectorEditor companyId={companyId} sectors={sectors} />
        </FormDialog>
      </div>
      {sectors.length === 0 ? (
        <p className="muted ledger-empty">Todavía no hay sectores. Sin esta lista el informe sigue alfabético.</p>
      ) : (
        <ul className="category-chips">
          {sectors.map((sector) => <li key={sector.id}>{sector.name}</li>)}
        </ul>
      )}
    </section>
  )
}

function SectorEditor({ companyId, sectors }: { companyId: string; sectors: CompanySector[] }) {
  const [state, action, pending] = useActionState(saveSector, { error: '', saved: false })
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.saved) form.current?.reset()
  }, [state.saved])

  return (
    <div className="stack-form">
      {sectors.length === 0 ? (
        <p className="muted">Todavía no hay sectores.</p>
      ) : (
        <div className="option-list">
          {sectors.map((sector, index) => (
            <div className="option-row" key={sector.id}>
              <span>{sector.name}</span>
              <div className="row-actions">
                <form action={moveSector}>
                  <input type="hidden" name="id" value={sector.id} />
                  <input type="hidden" name="company_id" value={companyId} />
                  <input type="hidden" name="direction" value="up" />
                  <button className="outline-button icon-action" type="submit" disabled={index === 0} aria-label={`Subir ${sector.name}`} title="Subir">
                    <ArrowUp size={15} />
                  </button>
                </form>
                <form action={moveSector}>
                  <input type="hidden" name="id" value={sector.id} />
                  <input type="hidden" name="company_id" value={companyId} />
                  <input type="hidden" name="direction" value="down" />
                  <button className="outline-button icon-action" type="submit" disabled={index === sectors.length - 1} aria-label={`Bajar ${sector.name}`} title="Bajar">
                    <ArrowDown size={15} />
                  </button>
                </form>
                <RenameSectorButton id={sector.id} name={sector.name} />
                <DeleteButton action={deleteSector} name={sector.name} fields={{ id: sector.id, company_id: companyId }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <form ref={form} action={action} className="stack-form">
        <input type="hidden" name="company_id" value={companyId} />
        <label className="field">Nuevo sector<input name="name" required placeholder="Administración, Planta…" /></label>
        {state.error && <p className="error-banner">{state.error}</p>}
        <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Agregando…' : 'Agregar sector'}</button>
      </form>
    </div>
  )
}

function RenameSectorButton({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, pending] = useActionState(updateSector, { error: '' })
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current && !pending && !state.error) {
      sent.current = false
      setEditing(false)
    }
  }, [pending, state.error])

  if (!editing) {
    return (
      <button className="outline-button icon-action" type="button" aria-label={`Editar ${name}`} title="Editar" onClick={() => setEditing(true)}>
        <Pencil size={15} />
      </button>
    )
  }

  return (
    <form
      action={formAction}
      className="inline-rename"
      onSubmit={() => {
        sent.current = true
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input name="name" defaultValue={name} required aria-label={`Editar ${name}`} />
      <button className="outline-button" type="submit" disabled={pending}>{pending ? '…' : 'Guardar'}</button>
      <button className="outline-button" type="button" onClick={() => setEditing(false)}>Cancelar</button>
      {state.error && <p className="error-banner">{state.error}</p>}
    </form>
  )
}

export function SectorSelect({
  sectors,
  value,
  required = false,
}: {
  sectors: CompanySector[]
  value?: string | null
  required?: boolean
}) {
  if (sectors.length === 0) return null
  return (
    <label className="field">Sector
      <select name="sector_id" defaultValue={value ?? ''} required={required}>
        <option value="">Sin sector</option>
        {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
      </select>
    </label>
  )
}
