'use client'

import { useState } from 'react'
import { saveSupplierPayment } from '@/lib/actions/balance'
import type { BalanceQuery } from '@/lib/balance'
import { BalanceReturn } from '@/components/balance-return'

export function SupplierPaymentForm({
  suppliers,
  defaultDate,
  query,
  issued = false,
  stacked = false,
  defaultSupplierId = '',
  onDone,
}: {
  suppliers: { id: string; name: string }[]
  defaultDate: string
  query: BalanceQuery
  issued?: boolean
  stacked?: boolean
  defaultSupplierId?: string
  onDone?: () => void
}) {
  const [method, setMethod] = useState(issued ? 'ECHEQ' : 'TRANSFERENCIA')

  return (
    <form
      action={async (formData) => {
        try {
          await saveSupplierPayment(formData)
        } finally {
          onDone?.()
        }
      }}
      className={stacked ? 'balance-form dialog-form' : 'balance-form'}
    >
      <BalanceReturn query={query} />
      <label className="field">{issued ? 'Fecha de pago' : 'Fecha'}<input type="date" name="paid_on" defaultValue={defaultDate} required /></label>
      <label className="field">Proveedor
        <select name="supplier_id" required defaultValue={defaultSupplierId}>
          <option value="" disabled>Elegí un proveedor</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
      </label>
      <label className="field">Concepto<input name="concept" placeholder="Verdulería, carne…" required /></label>
      <label className="field">Monto<input name="amount" inputMode="decimal" placeholder="0,00" required /></label>
      {issued ? <input type="hidden" name="method" value="ECHEQ" /> : (
        <label className="field">Medio
          <select name="method" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="ECHEQ">eCheq</option>
          </select>
        </label>
      )}
      {method === 'ECHEQ' && (
        <>
          <label className="field">Número de eCheq<input name="echeq_number" required /></label>
          <label className="field">Vencimiento<input type="date" name="echeq_date" required /></label>
        </>
      )}
      <label className="field">Estado
        <select name="status" defaultValue="PENDIENTE">
          <option value="PENDIENTE">Pendiente</option>
          <option value="PAGADO">Pagado</option>
        </select>
      </label>
      <button className="primary-button" type="submit">{issued ? 'Emitir eCheq' : 'Anotar pago'}</button>
    </form>
  )
}
