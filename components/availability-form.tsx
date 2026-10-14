'use client'

import { Fragment, useActionState, useState } from 'react'
import { saveAvailability, setServiceDay } from '@/lib/actions/calendar'

type Day = {
  id: string
  serviceDate: string
  isServiceDay: boolean
  optionIds: string[]
}

type Category = {
  id: string
  name: string
  options: { id: string; name: string }[]
}

export function AvailabilityForm({
  weekId,
  days,
  categories,
}: {
  weekId: string
  days: Day[]
  categories: Category[]
}) {
  const [state, action, pending] = useActionState(saveAvailability, { error: '', saved: false, slots: [] })
  const propsSlots = slotsFromDays(days)
  const propsSignature = weekSignature(days)
  const structure = days.map((day) => `${day.id}:${day.isServiceDay ? '1' : '0'}`).join(';')
  const [draft, setDraft] = useState<{ structure: string; slots: Set<string> } | null>(null)
  if (draft && (draft.structure !== structure || optionSignature(days, draft.slots) === propsSignature)) setDraft(null)
  const slots = draft?.slots ?? propsSlots
  const categoryOf = new Map(categories.flatMap((category) => category.options.map((option) => [option.id, category.id])))
  const emptyDays = days.filter((day) => day.isServiceDay && countDay(slots, day.id) === 0)
  const confirmed = state.saved ? new Set(state.slots) : null
  const saved = !!confirmed && sameSlots(slots, confirmed)

  return (
    <section className="panel week-grid-panel">
      <div className="week-grid-scroll">
        <table className="week-grid">
          <thead>
            <tr>
              <th className="option-col">Opción</th>
              {days.map((day) => {
                const empty = day.isServiceDay && countDay(slots, day.id) === 0
                return (
                  <th key={day.id} className={columnTone(day, empty)}>
                    <div className="day-head">
                      <strong>{weekdayName(day.serviceDate)}</strong>
                      <span>{Number(day.serviceDate.slice(8, 10))}</span>
                      <form action={setServiceDay}>
                        <input type="hidden" name="week_id" value={weekId} />
                        <input type="hidden" name="day_id" value={day.id} />
                        <input type="hidden" name="is_service_day" value={day.isServiceDay ? 'false' : 'true'} />
                        <button className="outline-button" type="submit">
                          {day.isServiceDay ? 'Sin servicio' : 'Con servicio'}
                        </button>
                      </form>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <Fragment key={category.id}>
                <tr className="week-grid-category">
                  <th className="option-col">{category.name}</th>
                  {days.map((day) => <td key={day.id} className={columnTone(day, day.isServiceDay && countDay(slots, day.id) === 0)} />)}
                </tr>
                {category.options.map((option) => (
                  <tr key={option.id}>
                    <th className="option-col">{option.name}</th>
                    {days.map((day) => {
                      const key = `${day.id}|${option.id}`
                      const empty = day.isServiceDay && countDay(slots, day.id) === 0
                      return (
                        <td key={day.id} className={columnTone(day, empty)}>
                          <input
                            type="checkbox"
                            checked={day.isServiceDay && slots.has(key)}
                            disabled={!day.isServiceDay}
                            aria-label={`${option.name}, ${weekdayName(day.serviceDate)}`}
                            onChange={(event) => {
                              const next = new Set(slots)
                              if (event.target.checked) next.add(key)
                              else next.delete(key)
                              setDraft({ structure, slots: next })
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {emptyDays.length > 0 && (
        <p className="muted">Los días en amarillo todavía no tienen opciones.</p>
      )}
      <form id="week-grid" action={action} className="stack-form">
        <input type="hidden" name="week_id" value={weekId} />
        {[...slots].map((key) => {
          const [dayId, optionId] = key.split('|')
          const categoryId = categoryOf.get(optionId)
          if (!categoryId) return null
          return <input key={key} type="hidden" name="slot" value={`${dayId}|${categoryId}|${optionId}`} />
        })}
        {state.error && <p className="error-banner">{state.error}</p>}
        {saved && <p className="success-banner">Semana guardada.</p>}
        <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar semana'}</button>
      </form>
    </section>
  )
}

function columnTone(day: Day, empty: boolean) {
  if (!day.isServiceDay) return 'is-off'
  if (empty) return 'is-empty'
  return ''
}

function countDay(slots: Set<string>, dayId: string) {
  let count = 0
  for (const key of slots) if (key.startsWith(`${dayId}|`)) count += 1
  return count
}

function slotsFromDays(days: Day[]) {
  return new Set(days.flatMap((day) => day.isServiceDay ? day.optionIds.map((optionId) => `${day.id}|${optionId}`) : []))
}

function weekSignature(days: Day[]) {
  return optionSignature(days, slotsFromDays(days))
}

function optionSignature(days: Day[], slots: Set<string>) {
  return days.map((day) => {
    if (!day.isServiceDay) return `${day.id}:off`
    const ids = [...slots].flatMap((key) => key.startsWith(`${day.id}|`) ? [key.slice(day.id.length + 1)] : [])
    ids.sort()
    return `${day.id}:${ids.join(',')}`
  }).join(';')
}

function sameSlots(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

function weekdayName(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 15))
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    timeZone: 'America/Argentina/Tucuman',
  }).format(date).replace('.', '')
}
