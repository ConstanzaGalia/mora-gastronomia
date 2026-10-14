'use client'

import { useState } from 'react'
import { saveFixedMonth } from '@/lib/actions/balance'
import type { BalanceQuery } from '@/lib/balance'
import { formatMoney } from '@/lib/format'
import { BalanceReturn } from '@/components/balance-return'

export function FixedMonthCell({
  expenseId,
  year,
  month,
  status,
  amount,
  query,
}: {
  expenseId: string
  year: number
  month: number
  status: 'PENDIENTE' | 'PAGADO' | 'NO_APLICA'
  amount: number | null
  query: BalanceQuery
}) {
  const [editing, setEditing] = useState(false)
  const tone = status === 'PAGADO' ? 'paid' : status === 'NO_APLICA' ? 'na' : 'pending'

  if (status === 'PENDIENTE' && editing) {
    return (
      <form action={saveFixedMonth} className="fixed-amount">
        <BalanceReturn query={query} />
        <input type="hidden" name="fixed_expense_id" value={expenseId} />
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="status" value="PAGADO" />
        <input name="amount" inputMode="decimal" placeholder="0,00" aria-label="Monto pagado" required autoFocus />
        <button type="submit">Ok</button>
      </form>
    )
  }

  const next = status === 'PAGADO' ? 'NO_APLICA' : 'PENDIENTE'
  const label = status === 'PAGADO' && amount != null ? formatMoney(amount) : status === 'NO_APLICA' ? 'No aplica' : 'Pendiente'

  if (status === 'PENDIENTE') {
    return (
      <button className={`fixed-state ${tone}`} type="button" onClick={() => setEditing(true)}>
        {label}
      </button>
    )
  }

  return (
    <form action={saveFixedMonth}>
      <BalanceReturn query={query} />
      <input type="hidden" name="fixed_expense_id" value={expenseId} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="status" value={next} />
      <button className={`fixed-state ${tone}`} type="submit">{label}</button>
    </form>
  )
}
