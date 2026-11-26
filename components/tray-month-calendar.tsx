'use client'

import { useRef } from 'react'
import { formatMonth } from '@/lib/format'
import {
  buildTrayMonthCells,
  formatTrayDayLabel,
  type MonthlyTrayDay,
} from '@/lib/monthly-trays'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function TrayDaysPopup({
  month,
  days,
  personName,
  showShifts = false,
}: {
  month: string
  days: MonthlyTrayDay[]
  personName: string
  showShifts?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const label = days.length === 1 ? '1 día' : `${days.length} días`

  return (
    <>
      <button
        className="outline-button tray-days-trigger"
        type="button"
        onClick={() => dialog.current?.showModal()}
      >
        Ver días
      </button>
      <dialog
        ref={dialog}
        className="company-dialog tray-cal-dialog"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close()
        }}
      >
        <div className="dialog-heading">
          <div>
            <h2>{personName}</h2>
            <p className="muted">{formatMonth(month)} · {label}</p>
          </div>
          <button className="outline-button" type="button" onClick={() => dialog.current?.close()}>
            Cerrar
          </button>
        </div>
        {showShifts ? (
          <p className="tray-cal-legend muted">
            <span className="tray-cal-swatch is-morning" /> Mañana
            <span className="tray-cal-swatch is-afternoon" /> Tarde
            <span className="tray-cal-swatch is-ordered" /> Sin turno
          </p>
        ) : null}
        <TrayMonthCalendar month={month} days={days} showShifts={showShifts} large />
      </dialog>
    </>
  )
}

function TrayMonthCalendar({
  month,
  days,
  showShifts = false,
  large = false,
}: {
  month: string
  days: MonthlyTrayDay[]
  showShifts?: boolean
  large?: boolean
}) {
  const cells = buildTrayMonthCells(month, days)
  return (
    <div
      className={`tray-cal${large ? ' is-large' : ''}`}
      title={days.map((day) => formatTrayDayLabel(day, showShifts)).join(', ')}
    >
      <div className="tray-cal-weekdays" aria-hidden>
        {WEEKDAYS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="tray-cal-grid" role="list" aria-label="Días con vianda">
        {cells.map((cell) => {
          if (cell.kind === 'pad') return <span key={cell.key} className="tray-cal-cell is-pad" />
          const shiftClass = !cell.ordered
            ? ''
            : showShifts && cell.mealShift === 'MORNING'
              ? ' is-morning'
              : showShifts && cell.mealShift === 'AFTERNOON'
                ? ' is-afternoon'
                : ' is-ordered'
          const label = cell.ordered
            ? formatTrayDayLabel({ serviceDate: cell.key, mealShift: cell.mealShift }, showShifts)
            : String(cell.day)
          return (
            <span
              key={cell.key}
              role="listitem"
              className={`tray-cal-cell is-day${shiftClass}`}
              title={label}
              aria-label={label}
            >
              {cell.day}
            </span>
          )
        })}
      </div>
    </div>
  )
}
