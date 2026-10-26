'use client'

import { useState } from 'react'
import { PAYMENT_STATE_LABEL, type PaymentState } from '@/lib/events'

const PAYMENTS = Object.entries(PAYMENT_STATE_LABEL) as [PaymentState, string][]

export function EventFilters({
  action,
  vista,
  month,
  year,
  cobro,
}: {
  action: string
  vista: 'mes' | 'anio'
  month: string
  year: string
  cobro?: string
}) {
  const [mode, setMode] = useState(vista)

  return (
    <form
      className="balance-filters event-filters"
      method="get"
      action={action}
      onChange={(event) => {
        const target = event.target
        if (target instanceof HTMLSelectElement && target.name === 'vista') setMode(target.value === 'anio' ? 'anio' : 'mes')
        if (target instanceof HTMLInputElement && target.name === 'anio') return
        event.currentTarget.requestSubmit()
      }}
    >
      <label className="field">Período
        <select name="vista" value={mode} onChange={(event) => setMode(event.target.value === 'anio' ? 'anio' : 'mes')}>
          <option value="mes">Un mes</option>
          <option value="anio">El año</option>
        </select>
      </label>
      {mode === 'mes' ? (
        <label className="field">Mes<input type="month" name="mes" defaultValue={month} /></label>
      ) : (
        <label className="field">Año<input name="anio" inputMode="numeric" defaultValue={year} onBlur={(event) => event.currentTarget.form?.requestSubmit()} /></label>
      )}
      {mode === 'mes' ? <input type="hidden" name="anio" value={year} /> : <input type="hidden" name="mes" value={month} />}
      {action === '/eventos' && (
        <label className="field">Pagos
          <select name="cobro" defaultValue={cobro ?? ''}>
            <option value="">Todos</option>
            {PAYMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      )}
    </form>
  )
}
