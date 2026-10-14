'use client'

import { useActionState } from 'react'
import { createWeek } from '@/lib/actions/calendar'
import { upcomingMonday } from '@/lib/format'

export function NewWeekForm() {
  const [state, action, pending] = useActionState(createWeek, { error: '' })
  return (
    <form action={action} className="form-row">
      <label className="field">Lunes de la semana<input type="date" name="week_start" defaultValue={upcomingMonday()} required /></label>
      <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Creando…' : 'Nueva semana'}</button>
      {state.error && <p className="error-banner">{state.error}</p>}
    </form>
  )
}
