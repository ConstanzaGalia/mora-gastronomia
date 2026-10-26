'use client'

import { useActionState, useEffect, useState } from 'react'
import { cancelSelection, saveSelection } from '@/lib/actions/menu'
import { formatDateTime, formatDay, formatLongDate, mondayOf } from '@/lib/format'
import { isOptionalCategory } from '@/lib/menu'

export type MenuRow = {
  calendar_day_id: string
  category_id: string
  category_name: string
  category_sort_order: number
  option_id: string
  option_name: string
  option_sort_order: number
  deadline: string
  window_open: boolean
  is_selected: boolean
}

export type MenuWeekDay = {
  serviceDate: string
  rows: MenuRow[]
  selectionId: string | null
}

export type MenuWeekGroup = {
  start: string
  days: MenuWeekDay[]
}

type DayState = 'elegida' | 'abierta' | 'cerrada' | 'sin-menu'

export function MenuWeek({ weeks, today }: { weeks: MenuWeekGroup[]; today: string }) {
  const defaultWeek = weeks.find((week) => week.start === mondayOf(today))?.start ?? weeks[0]?.start ?? ''
  const [weekStart, setWeekStart] = useState(defaultWeek)
  const [picked, setPicked] = useState<string | null>(null)
  const week = weeks.find((item) => item.start === weekStart) ?? weeks[0]
  if (!week) return null

  const selectedDate = week.days.some((day) => day.serviceDate === picked) ? picked : firstDay(week.days)
  const selected = week.days.find((day) => day.serviceDate === selectedDate) ?? week.days[0]

  return (
    <div className="menu-week">
      {weeks.length > 1 && (
        <div className="menu-week-switch" role="tablist" aria-label="Semanas">
          {weeks.map((item) => (
            <button
              key={item.start}
              type="button"
              role="tab"
              aria-selected={item.start === week.start}
              className={item.start === week.start ? 'active' : ''}
              onClick={() => {
                setWeekStart(item.start)
                setPicked(null)
              }}
            >
              {item.start === mondayOf(today) ? 'Esta semana' : `Semana del ${formatDay(item.start)}`}
            </button>
          ))}
        </div>
      )}
      <div className="menu-day-pills">
        {week.days.map((day) => {
          const state = dayState(day)
          const current = day.serviceDate === selected?.serviceDate
          return (
            <button
              key={day.serviceDate}
              type="button"
              className={`menu-day-pill ${state}${current ? ' is-current' : ''}`}
              aria-pressed={current}
              onClick={() => setPicked(day.serviceDate)}
            >
              <small>{weekdayName(day.serviceDate)}</small>
              <strong>{Number(day.serviceDate.slice(8, 10))}</strong>
              <span>{stateLabel(state)}</span>
            </button>
          )
        })}
      </div>
      {selected && <DayCombination key={`${selected.serviceDate}-${selectionKey(selected)}`} day={selected} />}
    </div>
  )
}

function DayCombination({ day }: { day: MenuWeekDay }) {
  const [state, action, pending] = useActionState(saveSelection, { error: '', saved: false })
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (state.saved) setEditing(false)
  }, [state])
  const groups = categoryGroups(day.rows)
  const open = day.rows[0]?.window_open ?? false
  const status = dayState(day)
  const chosen = status === 'elegida'
  const showForm = open && (!chosen || editing)

  return (
    <section className="panel menu-combo">
      <div className="panel-heading">
        <div>
          <h2>{formatLongDate(day.serviceDate)}</h2>
          <p className="muted">{dayCopy(day, open, chosen)}</p>
        </div>
        <span className={`status-badge ${badgeTone(status)}`}>{stateLabel(status)}</span>
      </div>
      {day.rows.length === 0 ? null : showForm ? (
        <form action={action} className="stack-form">
          <input type="hidden" name="calendar_day_id" value={day.rows[0].calendar_day_id} />
          {groups.filter((options) => !isOptionalCategory(options[0].category_name)).map((options) => (
            <span key={options[0].category_id}>
              <input type="hidden" name="required_category" value={options[0].category_id} />
              <input type="hidden" name="required_name" value={options[0].category_name} />
            </span>
          ))}
          {groups.filter((options) => isOptionalCategory(options[0].category_name)).map((options) => (
            <input key={options[0].category_id} type="hidden" name="optional_name" value={options[0].category_name} />
          ))}
          {groups.map((options) => {
            const optional = isOptionalCategory(options[0].category_name)
            const selected = options.some((option) => option.is_selected)
            return (
              <fieldset key={options[0].category_id}>
                <legend>{options[0].category_name}{optional ? ' · opcional' : ''}</legend>
                <div className="combo-options">
                  {optional && (
                    <label className="combo-option">
                      <input
                        type="radio"
                        name={`item-${options[0].category_id}`}
                        value=""
                        defaultChecked={!selected}
                      />
                      Sin {options[0].category_name.toLowerCase()}
                    </label>
                  )}
                  {options.map((option) => (
                    <label key={option.option_id} className="combo-option">
                      <input
                        type="radio"
                        name={`item-${option.category_id}`}
                        value={`${option.category_id}|${option.option_id}`}
                        defaultChecked={option.is_selected}
                      />
                      {option.option_name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )
          })}
          {state.error && <p className="error-banner">{state.error}</p>}
          <div className="menu-combo-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={pending}
              onClick={(event) => {
                const form = event.currentTarget.form
                if (!form) return
                form.querySelectorAll('input[name="item"]').forEach((node) => node.remove())
                form.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked').forEach((input) => {
                  if (!input.value.includes('|')) return
                  const hidden = document.createElement('input')
                  hidden.type = 'hidden'
                  hidden.name = 'item'
                  hidden.value = input.value
                  form.appendChild(hidden)
                })
              }}
            >
              {pending ? 'Guardando…' : chosen ? 'Guardar cambios' : 'Confirmar menú'}
            </button>
            {chosen && (
              <button className="outline-button" type="button" onClick={() => setEditing(false)}>
                Volver
              </button>
            )}
          </div>
        </form>
      ) : chosen ? (
        <ChosenMenu groups={groups} />
      ) : (
        <p className="muted ledger-empty">No hay una elección guardada para este día.</p>
      )}
      {open && chosen && !editing && (
        <div className="menu-combo-actions">
          <button className="primary-button" type="button" onClick={() => setEditing(true)}>Cambiar elección</button>
          {day.selectionId && (
            <form action={cancelSelection}>
              <input type="hidden" name="selection_id" value={day.selectionId} />
              <button className="outline-button" type="submit">Anular elección</button>
            </form>
          )}
        </div>
      )}
    </section>
  )
}

function ChosenMenu({ groups }: { groups: MenuRow[][] }) {
  return (
    <div className="chosen-menu">
      <p className="chosen-menu-title">Tu menú</p>
      <div className="chosen-list">
        {groups.map((options) => {
          const chosen = options.find((option) => option.is_selected)
          return (
            <p key={options[0].category_id}>
              <span>{options[0].category_name}</span>
              <strong>{chosen?.option_name ?? (isOptionalCategory(options[0].category_name) ? `Sin ${options[0].category_name.toLowerCase()}` : 'Sin elección')}</strong>
            </p>
          )
        })}
      </div>
    </div>
  )
}

function dayCopy(day: MenuWeekDay, open: boolean, chosen: boolean) {
  if (day.rows.length === 0) return 'Ese día no tiene opciones para tu empresa.'
  if (chosen && !open) return 'Menú confirmado. El plazo para cambiarlo ya pasó.'
  if (chosen && open && new Date(day.rows[0].deadline).getTime() <= Date.now()) {
    return 'Ya confirmaste este menú. Con la extensión podés cambiarlo hasta las 9:00 de hoy.'
  }
  if (chosen && open) return `Ya confirmaste este menú. Podés cambiarlo hasta el ${formatDateTime(day.rows[0].deadline)}`
  if (open && new Date(day.rows[0].deadline).getTime() <= Date.now()) return 'Extensión horaria: podés elegir hasta las 9:00 de hoy.'
  if (open) return `Todavía no confirmaste. Podés elegir hasta el ${formatDateTime(day.rows[0].deadline)}`
  return 'El plazo ya pasó y no hay una elección para este día.'
}

function categoryGroups(rows: MenuRow[]) {
  const groups = new Map<string, MenuRow[]>()
  for (const row of [...rows].sort((a, b) => a.category_sort_order - b.category_sort_order || a.option_sort_order - b.option_sort_order)) {
    const list = groups.get(row.category_id) ?? []
    list.push(row)
    groups.set(row.category_id, list)
  }
  return [...groups.values()]
}

function dayState(day: MenuWeekDay): DayState {
  if (day.rows.length === 0) return 'sin-menu'
  const chosen = Boolean(day.selectionId) || day.rows.some((row) => row.is_selected)
  if (chosen) return 'elegida'
  if (!day.rows[0]?.window_open) return 'cerrada'
  return 'abierta'
}

function stateLabel(state: DayState) {
  if (state === 'elegida') return 'Elegida'
  if (state === 'abierta') return 'Por elegir'
  if (state === 'sin-menu') return 'Sin menú'
  return 'Sin elegir'
}

function badgeTone(state: DayState) {
  if (state === 'elegida') return 'published'
  if (state === 'abierta') return 'editing'
  if (state === 'sin-menu') return 'muted'
  return 'locked'
}

function firstDay(days: MenuWeekDay[]) {
  return (
    days.find((day) => dayState(day) === 'abierta')?.serviceDate
    ?? days.find((day) => day.rows[0]?.window_open)?.serviceDate
    ?? days[0]?.serviceDate
    ?? null
  )
}

function selectionKey(day: MenuWeekDay) {
  return day.rows.filter((row) => row.is_selected).map((row) => row.option_id).join('-')
}

function weekdayName(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 15))
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    timeZone: 'America/Argentina/Tucuman',
  }).format(date).replace('.', '')
}
