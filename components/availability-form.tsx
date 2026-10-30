'use client'

import { Fragment, useActionState, useState } from 'react'
import { saveAvailability, setServiceDay } from '@/lib/actions/calendar'
import { foldSearch } from '@/lib/format'

type Day = {
  id: string
  serviceDate: string
  isServiceDay: boolean
  optionIds: string[]
}

type Category = {
  id: string
  name: string
  slug: string
  options: { id: string; name: string }[]
}

export function AvailabilityForm({
  weekId,
  days,
  categories,
  published,
}: {
  weekId: string
  days: Day[]
  categories: Category[]
  published: boolean
}) {
  const [state, action, pending] = useActionState(saveAvailability, { error: '', saved: false, slots: [] })
  const [query, setQuery] = useState('')
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
  const serviceDays = days.filter((day) => day.isServiceDay)
  const term = query.trim().toLowerCase()
  const repeats = trayRepeats(categories, days, slots)
  const visible = categories.flatMap((category) => {
    const options = category.options
    if (options.length === 0) return []
    if (!term) return [{ ...category, options }]
    const categoryMatch = matchesQuery(category.name, term) || matchesQuery(category.slug, term)
    const matched = categoryMatch ? options : options.filter((option) => matchesQuery(option.name, term))
    if (matched.length === 0) return []
    return [{ ...category, options: matched }]
  })

  function setSlot(key: string, on: boolean) {
    const next = new Set(slots)
    if (on) next.add(key)
    else next.delete(key)
    setDraft({ structure, slots: next })
  }

  function setAllDays(optionId: string, on: boolean) {
    const next = new Set(slots)
    for (const day of serviceDays) {
      const key = `${day.id}|${optionId}`
      if (on) next.add(key)
      else next.delete(key)
    }
    setDraft({ structure, slots: next })
  }

  return (
    <section className="panel week-grid-panel">
      <div className="panel-heading week-grid-heading">
        <div>
          <h2>{published ? 'Menú publicado' : 'Armar la semana'}</h2>
          <p className="muted">
            {published
              ? 'Podés sumar opciones o sacar las que nadie eligió (bandeja, postre, bebida, pan).'
              : 'Marcá cada día o usá Todos para opciones que se ofrecen toda la semana, como pan y bebidas.'}
          </p>
        </div>
        <label className="field catalog-search">
          Buscar
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Opción o categoría" />
        </label>
      </div>
      {repeats.length > 0 && (
        <p className="warn-banner">
          Esta semana se repite bandeja: {formatRepeats(repeats)}. Conviene no repetir el mismo plato.
        </p>
      )}
      {visible.length === 0 ? (
        <p className="muted">
          {term ? 'No hay coincidencias para esa búsqueda.' : 'No hay opciones en el catálogo.'}
        </p>
      ) : (
        <div className="week-grid-scroll">
          <table className="week-grid is-editing">
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
              {visible.map((category) => (
                <Fragment key={category.id}>
                  <tr className="week-grid-category">
                    <th className="option-col">{category.name}</th>
                    {days.map((day) => (
                      <td key={day.id} className={columnTone(day, day.isServiceDay && countDay(slots, day.id) === 0)} />
                    ))}
                  </tr>
                  {category.options.map((option) => {
                    const markedDays = serviceDays.filter((day) => slots.has(`${day.id}|${option.id}`)).length
                    const allOn = serviceDays.length > 0 && markedDays === serviceDays.length
                    const mixed = markedDays > 0 && !allOn
                    const allowAllDays = !isTrayCategory(category)
                    return (
                      <tr key={option.id}>
                        <th className="option-col">
                          <div className="option-label">
                            <span>{option.name}</span>
                            {allowAllDays && (
                              <AllDaysToggle
                                optionName={option.name}
                                checked={allOn}
                                mixed={mixed}
                                disabled={serviceDays.length === 0}
                                onChange={(on) => setAllDays(option.id, on)}
                              />
                            )}
                          </div>
                        </th>
                        {days.map((day) => {
                          const key = `${day.id}|${option.id}`
                          const empty = day.isServiceDay && countDay(slots, day.id) === 0
                          const offered = day.isServiceDay && slots.has(key)
                          return (
                            <td key={day.id} className={columnTone(day, empty)}>
                              <input
                                type="checkbox"
                                checked={offered}
                                disabled={!day.isServiceDay}
                                aria-label={`${option.name}, ${weekdayName(day.serviceDate)}`}
                                onChange={(event) => setSlot(key, event.target.checked)}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function AllDaysToggle({
  optionName,
  checked,
  mixed,
  disabled,
  onChange,
}: {
  optionName: string
  checked: boolean
  mixed: boolean
  disabled: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className="all-days">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        ref={(node) => {
          if (node) node.indeterminate = mixed
        }}
        aria-label={`Todos los días: ${optionName}`}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>Todos</span>
    </label>
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

function isTrayCategory(category: Category) {
  const slug = category.slug.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const name = category.name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  return slug === 'bandeja' || name === 'bandeja'
}

function trayRepeats(categories: Category[], days: Day[], slots: Set<string>) {
  return categories.filter(isTrayCategory).flatMap((category) => category.options).flatMap((option) => {
    const onDays = days.filter((day) => day.isServiceDay && slots.has(`${day.id}|${option.id}`))
    return onDays.length > 1
      ? [{ name: option.name, days: onDays.map((day) => weekdayName(day.serviceDate)) }]
      : []
  })
}

function formatRepeats(repeats: { name: string; days: string[] }[]) {
  return repeats.map((item) => `${item.name} (${joinList(item.days)})`).join('; ')
}

function joinList(items: string[]) {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} y ${items[1]}`
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

function matchesQuery(text: string, term: string) {
  const needle = foldSearch(term)
  if (!needle) return true
  const normalized = foldSearch(text)
  let from = 0
  while (from <= normalized.length) {
    const index = normalized.indexOf(needle, from)
    if (index === -1) return false
    if (index === 0 || /[^a-z0-9]/.test(normalized[index - 1] ?? '')) return true
    from = index + 1
  }
  return false
}
