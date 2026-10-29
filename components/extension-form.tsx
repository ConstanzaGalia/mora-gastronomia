'use client'

import { useMemo, useState } from 'react'
import { saveExtensions } from '@/lib/actions/calendar'
import { matchesSearch } from '@/lib/format'

type Day = { id: string; serviceDate: string; isServiceDay: boolean }
type Company = { id: string; nombre_comercial: string }

export function ExtensionForm({
  weekId,
  days,
  companies,
  enabled,
}: {
  weekId: string
  days: Day[]
  companies: Company[]
  enabled: string[]
}) {
  const serviceDays = days.filter((day) => day.isServiceDay)
  const [query, setQuery] = useState('')
  const enabledKey = [...enabled].sort().join('\n')
  const [baseline, setBaseline] = useState(enabledKey)
  const [marked, setMarked] = useState(() => new Set(enabled))
  if (baseline !== enabledKey) {
    setBaseline(enabledKey)
    setMarked(new Set(enabled))
  }
  const term = query.trim()
  const visible = useMemo(
    () => companies.filter((company) => matchesSearch(company.nombre_comercial, term)),
    [companies, term],
  )

  function setKey(key: string, on: boolean) {
    setMarked((current) => {
      const next = new Set(current)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  function toggleDay(dayId: string) {
    const keys = visible.map((company) => `${dayId}|${company.id}`)
    const allOn = keys.length > 0 && keys.every((key) => marked.has(key))
    setMarked((current) => {
      const next = new Set(current)
      for (const key of keys) {
        if (allOn) next.delete(key)
        else next.add(key)
      }
      return next
    })
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Extensión horaria</h2>
          <p className="muted">De 7:00 a 9:00 del mismo día, el encargado y los empleados de la empresa pueden seguir eligiendo.</p>
        </div>
      </div>
      {companies.length === 0 || serviceDays.length === 0 ? (
        <p className="muted">Necesitás empresas activas y días de servicio para habilitar la extensión.</p>
      ) : (
        <form action={saveExtensions} className="stack-form">
          <input type="hidden" name="week_id" value={weekId} />
          {[...marked].map((key) => <input key={key} type="hidden" name="extension" value={key} />)}
          <div className="extension-tools">
            <label className="field">
              Buscar empresa
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre" />
            </label>
            <p className="muted">{visible.length} de {companies.length}</p>
          </div>
          {visible.length === 0 ? <p className="muted">Ninguna empresa coincide con esa búsqueda.</p> : (
            <div className="week-grid-scroll">
              <table className="week-grid extension-grid">
                <thead>
                  <tr>
                    <th className="option-col">Empresa</th>
                    {serviceDays.map((day) => {
                      const keys = visible.map((company) => `${day.id}|${company.id}`)
                      const allOn = keys.every((key) => marked.has(key))
                      return (
                        <th key={day.id}>
                          <div className="day-head">
                            <strong>{weekdayName(day.serviceDate)}</strong>
                            <span>{Number(day.serviceDate.slice(8, 10))}</span>
                            <label className="check-line">
                              <input
                                type="checkbox"
                                checked={allOn}
                                aria-label={`Marcar ${weekdayName(day.serviceDate)} para las empresas visibles`}
                                onChange={() => toggleDay(day.id)}
                              />
                            </label>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => {
                    const shown = matchesSearch(company.nombre_comercial, term)
                    return (
                      <tr key={company.id} hidden={!shown}>
                        <th className="option-col">{company.nombre_comercial}</th>
                        {serviceDays.map((day) => {
                          const key = `${day.id}|${company.id}`
                          return (
                            <td key={day.id}>
                              <label className="check-line">
                                <input
                                  type="checkbox"
                                  checked={marked.has(key)}
                                  aria-label={`${company.nombre_comercial}, ${weekdayName(day.serviceDate)}`}
                                  onChange={(event) => setKey(key, event.target.checked)}
                                />
                              </label>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <button className="outline-button" type="submit">Guardar extensión</button>
        </form>
      )}
    </section>
  )
}

function weekdayName(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 15))
  return new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'America/Argentina/Tucuman' }).format(date).replace('.', '')
}
