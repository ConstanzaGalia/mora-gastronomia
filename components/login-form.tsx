'use client'

import { useActionState } from 'react'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { login } from '@/lib/actions/auth'

export function LoginForm() {
  const [mode, setMode] = useState<'admin' | 'employee'>('employee')
  const [state, action, pending] = useActionState(login, { error: '' })

  return (
    <form action={action}>
      <input type="hidden" name="mode" value={mode} />
      <div className="mode-tabs">
        <button type="button" className={mode === 'employee' ? 'active' : ''} onClick={() => setMode('employee')}>Empleado</button>
        <button type="button" className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')}>Administrador</button>
      </div>
      {mode === 'admin' ? (
        <label>Email<input name="email" type="email" autoComplete="username" placeholder="tu@empresa.com" required /></label>
      ) : (
        <label>DNI<input name="dni" inputMode="numeric" autoComplete="username" placeholder="Ingresá tu DNI" required /></label>
      )}
      <label>
        Contraseña
        <input name="password" type="password" autoComplete="current-password" placeholder={mode === 'employee' ? 'Tu DNI' : 'Ingresá tu contraseña'} required />
      </label>
      {state.error && <p className="error-banner">{state.error}</p>}
      <button className="primary-button login-submit" type="submit" disabled={pending}>
        {pending ? 'Ingresando…' : 'Ingresar'} <ArrowRight size={16} />
      </button>
    </form>
  )
}
