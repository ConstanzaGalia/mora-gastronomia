'use client'

import { useState } from 'react'

export function BalanceFilters({
  vista,
  month,
  year,
  seccion,
  empresa,
}: {
  vista: 'mes' | 'anio'
  month: string
  year: string
  seccion?: string
  empresa?: string
}) {
  const [mode, setMode] = useState(vista)

  return (
    <form
      className="balance-filters"
      method="get"
      onChange={(event) => {
        const target = event.target
        if (target instanceof HTMLSelectElement) setMode(target.value === 'anio' ? 'anio' : 'mes')
        if (target instanceof HTMLInputElement && target.name === 'anio') return
        event.currentTarget.requestSubmit()
      }}
    >
      <label className="field">Vista
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
      {seccion && seccion !== 'empresas' && <input type="hidden" name="seccion" value={seccion} />}
      {empresa && <input type="hidden" name="empresa" value={empresa} />}
    </form>
  )
}
