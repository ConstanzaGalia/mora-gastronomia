'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { formatLongDate, formatMonth } from '@/lib/format'

export function DinerCalendar({ date, empresa, path = '/comensales' }: { date: string; empresa?: string; path?: string }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(date.slice(0, 7))
  const root = useRef<HTMLDivElement>(null)
  const days = monthCells(month)

  useEffect(() => {
    setMonth(date.slice(0, 7))
    setOpen(false)
  }, [date])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open])

  return (
    <div className="diner-calendar" ref={root}>
      <button className="outline-button diner-date-button" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <CalendarDays size={16} />
        {dateLabel(date)}
      </button>
      {open && (
        <div className="diner-month">
          <div className="diner-month-nav">
            <button type="button" aria-label="Mes anterior" onClick={() => setMonth((current) => shiftMonth(current, -1))}>‹</button>
            <span>{monthLabel(month)}</span>
            <button type="button" aria-label="Mes siguiente" onClick={() => setMonth((current) => shiftMonth(current, 1))}>›</button>
          </div>
          <div className="diner-weekdays" aria-hidden="true">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="diner-days">
            {days.map((day, index) => day ? (
              <Link
                key={day}
                href={href(day, empresa, path)}
                className={day === date ? 'is-selected' : ''}
                onClick={() => setOpen(false)}
                aria-current={day === date ? 'date' : undefined}
              >
                {Number(day.slice(8, 10))}
              </Link>
            ) : <span key={`empty-${index}`} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function dateLabel(isoDate: string) {
  return capitalize(formatLongDate(isoDate))
}

function monthLabel(month: string) {
  return capitalize(formatMonth(month))
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function href(date: string, empresa: string | undefined, path: string) {
  const params = new URLSearchParams({ fecha: date })
  if (empresa) params.set('empresa', empresa)
  return `${path}?${params.toString()}`
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

function monthCells(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() || 7
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const cells: Array<string | null> = Array.from({ length: firstWeekday - 1 }, () => null)
  for (let day = 1; day <= count; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`)
  }
  return cells
}
