'use client'

import { useState } from 'react'

export type ViandaPeriodVista = 'dia' | 'semana' | 'mes'

export function ViandaPeriodFilters({
  vista,
  date,
  month,
  empresa,
  companies,
}: {
  vista: ViandaPeriodVista
  date: string
  month: string
  empresa: string
  companies: { id: string; nombre_comercial: string }[]
}) {
  const [mode, setMode] = useState(vista)

  return (
    <form
      className="balance-filters report-filters"
      method="get"
      action="/reportes/totales"
      onChange={(event) => {
        const target = event.target
        if (target instanceof HTMLSelectElement && target.name === 'vista') {
          setMode(target.value === 'semana' ? 'semana' : target.value === 'mes' ? 'mes' : 'dia')
        }
        if (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'number')) return
        event.currentTarget.requestSubmit()
      }}
    >
      <label className="field">
        Vista
        <select
          name="vista"
          value={mode}
          onChange={(event) => {
            const next = event.target.value
            setMode(next === 'semana' ? 'semana' : next === 'mes' ? 'mes' : 'dia')
          }}
        >
          <option value="dia">Un día</option>
          <option value="semana">Una semana</option>
          <option value="mes">Un mes</option>
        </select>
      </label>
      {mode === 'mes' ? (
        <label className="field">
          Mes
          <input type="month" name="mes" defaultValue={month} />
        </label>
      ) : (
        <label className="field">
          {mode === 'semana' ? 'Semana de' : 'Fecha'}
          <input type="date" name="fecha" defaultValue={date} />
        </label>
      )}
      {mode === 'mes' ? <input type="hidden" name="fecha" value={date} /> : <input type="hidden" name="mes" value={month} />}
      <label className="field">
        Empresa
        <select name="empresa" defaultValue={empresa}>
          <option value="">Todas</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>{company.nombre_comercial}</option>
          ))}
        </select>
      </label>
    </form>
  )
}
