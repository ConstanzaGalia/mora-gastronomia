'use client'

import { useActionState, useEffect } from 'react'
import { useDialogClose } from '@/components/form-dialog'
import { addScopedPerson, resetScopedPassword, type AccessState } from '@/lib/actions/access'

const initial: AccessState = { error: '', notice: '' }

export function AccessPersonForm({
  roles,
}: {
  roles: { id: string; name: string }[]
}) {
  const close = useDialogClose()
  const [state, action, pending] = useActionState(addScopedPerson, initial)

  useEffect(() => {
    if (state.notice && !state.error) close()
  }, [state, close])

  if (!roles.length) {
    return <p className="muted">Primero creá un rol con pantallas y empresas.</p>
  }

  return (
    <form action={action} className="stack-form">
      <label className="field">
        Rol
        <select name="access_role_id" required defaultValue={roles[0]?.id}>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </label>
      <label className="field">DNI<input name="dni" inputMode="numeric" required /></label>
      <label className="field">Nombre<input name="nombre" required /></label>
      <label className="field">Apellido<input name="apellido" required /></label>
      <label className="field">Email<input name="email" type="email" required placeholder="camila@arcorpormora.com" /></label>
      <label className="field">Contraseña inicial<input name="password" type="password" required minLength={6} /></label>
      {state.error ? <p className="error-banner">{state.error}</p> : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? 'Creando…' : 'Sumar persona'}
      </button>
    </form>
  )
}

export function ResetScopedPasswordForm({ userId }: { userId: string }) {
  const close = useDialogClose()
  const [state, action, pending] = useActionState(resetScopedPassword, initial)

  useEffect(() => {
    if (state.notice && !state.error) close()
  }, [state, close])

  return (
    <form action={action} className="stack-form">
      <input type="hidden" name="user_id" value={userId} />
      <label className="field">
        Nueva contraseña
        <input name="password" type="password" required minLength={6} />
      </label>
      {state.error ? <p className="error-banner">{state.error}</p> : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}
