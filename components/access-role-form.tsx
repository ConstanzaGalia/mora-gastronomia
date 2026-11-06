'use client'

import { useActionState, useEffect } from 'react'
import { useDialogClose } from '@/components/form-dialog'
import { saveAccessRole, type AccessState } from '@/lib/actions/access'
import { ACCESS_VIEW_LABEL, type AccessView } from '@/lib/format'
import { ALL_ACCESS_VIEWS } from '@/lib/access'

const initial: AccessState = { error: '', notice: '' }

export function AccessRoleForm({
  roleId,
  name = '',
  views = [],
  companyIds = [],
  companies,
}: {
  roleId?: string
  name?: string
  views?: AccessView[]
  companyIds?: string[]
  companies: { id: string; nombre_comercial: string; business_space_id: string; space_name: string }[]
}) {
  const close = useDialogClose()
  const [state, action, pending] = useActionState(saveAccessRole, initial)

  useEffect(() => {
    if (state.notice && !state.error) close()
  }, [state, close])

  const bySpace = new Map<string, typeof companies>()
  for (const company of companies) {
    const list = bySpace.get(company.business_space_id) ?? []
    list.push(company)
    bySpace.set(company.business_space_id, list)
  }

  return (
    <form action={action} className="stack-form">
      {roleId ? <input type="hidden" name="role_id" value={roleId} /> : null}
      <label className="field">
        Nombre del rol
        <input name="name" defaultValue={name} required placeholder="Ej. Cocina Arcor" />
      </label>

      <fieldset className="people-other-companies">
        <legend>Pantallas</legend>
        <p className="muted">Solo lectura, filtrada por las empresas del rol.</p>
        {ALL_ACCESS_VIEWS.map((view) => (
          <label className="combo-option" key={view}>
            <input type="checkbox" name="views" value={view} defaultChecked={views.includes(view)} />
            {ACCESS_VIEW_LABEL[view]}
          </label>
        ))}
      </fieldset>

      <fieldset className="people-other-companies">
        <legend>Empresas</legend>
        <p className="muted">Todas tienen que ser del mismo espacio.</p>
        {[...bySpace.entries()].map(([spaceId, spaceCompanies]) => (
          <div key={spaceId} className="stack-form" style={{ gap: '0.4rem' }}>
            <strong>{spaceCompanies[0]?.space_name ?? 'Espacio'}</strong>
            {spaceCompanies.map((company) => (
              <label className="combo-option" key={company.id}>
                <input
                  type="checkbox"
                  name="company_ids"
                  value={company.id}
                  defaultChecked={companyIds.includes(company.id)}
                />
                {company.nombre_comercial}
              </label>
            ))}
          </div>
        ))}
      </fieldset>

      {state.error ? <p className="error-banner">{state.error}</p> : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : roleId ? 'Guardar cambios' : 'Crear rol'}
      </button>
    </form>
  )
}
