'use client'

import { useState } from 'react'
import { saveCompanyExtras } from '@/lib/actions/choices'

type ExtraGroup = {
  id: string
  name: string
  options: { id: string; name: string; quantity: number }[]
}

export function ExtrasForm({
  date,
  dayId,
  groups,
  companyId,
  submitLabel = 'Guardar extras',
}: {
  date: string
  dayId: string
  groups: ExtraGroup[]
  companyId?: string
  submitLabel?: string
}) {
  return (
    <form action={saveCompanyExtras} className="extras-form">
      <input type="hidden" name="fecha" value={date} />
      <input type="hidden" name="calendar_day_id" value={dayId} />
      {companyId && <input type="hidden" name="company_id" value={companyId} />}
      {groups.map((group) => (
        <section className="extras-group" key={group.id}>
          <h3>{group.name}</h3>
          {group.options.map((option) => (
            <label className="extras-row" key={option.id}>
              <span>{option.name}</span>
              <input type="hidden" name="option" value={`${group.id}|${option.id}`} />
              <ExtraStepper defaultValue={option.quantity} />
            </label>
          ))}
        </section>
      ))}
      <button className="primary-button" type="submit">{submitLabel}</button>
    </form>
  )
}

function ExtraStepper({ defaultValue }: { defaultValue: number }) {
  const [value, setValue] = useState(Math.max(0, defaultValue))

  return (
    <div className="extras-stepper">
      <button type="button" aria-label="Restar" onClick={() => setValue((current) => Math.max(0, current - 1))}>−</button>
      <input
        name="quantity"
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value)
          setValue(Number.isFinite(next) && next >= 0 ? Math.floor(next) : 0)
        }}
      />
      <button type="button" aria-label="Sumar" onClick={() => setValue((current) => current + 1)}>+</button>
    </div>
  )
}
