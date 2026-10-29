import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonth, shiftMonth } from '@/lib/format'

export function EventPeriodNav({
  base,
  vista,
  month,
  year,
}: {
  base: string
  vista: 'mes' | 'anio'
  month: string
  year: string
}) {
  const yearNumber = Number(year)
  const previous = vista === 'anio' ? `${base}?vista=anio&anio=${yearNumber - 1}` : `${base}?mes=${shiftMonth(month, -1)}`
  const next = vista === 'anio' ? `${base}?vista=anio&anio=${yearNumber + 1}` : `${base}?mes=${shiftMonth(month, 1)}`
  const toggle = vista === 'anio' ? `${base}?mes=${month}` : `${base}?vista=anio&anio=${year}`

  return (
    <div className="period-nav">
      <Link className="round-button" href={previous} aria-label={vista === 'anio' ? 'Año anterior' : 'Mes anterior'}><ChevronLeft size={15} /></Link>
      <strong>{vista === 'anio' ? year : formatMonth(month)}</strong>
      <Link className="round-button" href={next} aria-label={vista === 'anio' ? 'Año siguiente' : 'Mes siguiente'}><ChevronRight size={15} /></Link>
      <Link className="text-button" href={toggle}>{vista === 'anio' ? 'Ver un mes' : 'Ver el año'}</Link>
    </div>
  )
}
