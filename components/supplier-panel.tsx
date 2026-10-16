'use client'

import { useRef, useState } from 'react'
import { BalanceReturn } from '@/components/balance-return'
import { DeleteButton } from '@/components/delete-button'
import { EmptyState } from '@/components/empty-state'
import { SupplierPaymentForm } from '@/components/supplier-payment-form'
import { deleteSupplier, deleteSupplierPayment, saveSupplier, setSupplierPaymentStatus } from '@/lib/actions/balance'
import { balanceFields, type BalanceQuery } from '@/lib/balance'
import { formatDay, formatMoney } from '@/lib/format'

const METHODS = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', ECHEQ: 'eCheq' } as const

type Supplier = { id: string; name: string; active: boolean }
type Payment = {
  id: string
  supplier_id: string
  paid_on: string
  concept: string
  amount: number
  method: keyof typeof METHODS
  status: 'PENDIENTE' | 'PAGADO'
  echeq_number: string | null
  echeq_date: string | null
}

export function SupplierPanel({
  suppliers,
  payments,
  periodName,
  defaultDate,
  query,
}: {
  suppliers: Supplier[]
  payments: Payment[]
  periodName: string
  defaultDate: string
  query: BalanceQuery
}) {
  const addDialog = useRef<HTMLDialogElement>(null)
  const payDialog = useRef<HTMLDialogElement>(null)
  const [addKey, setAddKey] = useState(0)
  const [payKey, setPayKey] = useState(0)
  const [supplierId, setSupplierId] = useState('')
  const active = suppliers.filter((supplier) => supplier.active)
  const fields = balanceFields(query)

  function openAdd() {
    setAddKey((value) => value + 1)
    addDialog.current?.showModal()
  }

  function openPayment(id = '') {
    setSupplierId(id)
    setPayKey((value) => value + 1)
    payDialog.current?.showModal()
  }

  return (
    <section className="panel">
      <div className="panel-heading supplier-heading">
        <div>
          <h2>Proveedores</h2>
          <p className="muted">Un pendiente no entra en el {periodName}. Al marcarlo pagado cuenta con la fecha de pago.</p>
        </div>
        <div className="heading-actions">
          <button className="outline-button" type="button" onClick={openAdd}>Agregar proveedor</button>
          <button className="primary-button" type="button" onClick={() => openPayment()} disabled={active.length === 0}>Anotar pago</button>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState title="Todavía no hay proveedores" description="Agregá uno para empezar a anotar pagos." />
      ) : (
        <div className="table-wrap">
          <table className="balance-table">
            <thead>
              <tr><th>PROVEEDOR</th><th className="num">PAGOS</th><th className="num">PENDIENTE</th><th className="num">PAGADO</th><th></th></tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => {
                const rows = payments.filter((payment) => payment.supplier_id === supplier.id)
                const pending = rows.filter((payment) => payment.status === 'PENDIENTE').reduce((total, payment) => total + payment.amount, 0)
                const paid = rows.filter((payment) => payment.status === 'PAGADO').reduce((total, payment) => total + payment.amount, 0)
                return (
                  <tr key={supplier.id}>
                    <td>{supplier.name}</td>
                    <td className="num">{rows.length}</td>
                    <td className="num">{formatMoney(pending)}</td>
                    <td className="num">{formatMoney(paid)}</td>
                    <td className="row-action">
                      <div className="row-buttons">
                        {supplier.active && <button className="outline-button" type="button" onClick={() => openPayment(supplier.id)}>Anotar pago</button>}
                        <DeleteButton action={deleteSupplier} name={supplier.name} label="Quitar proveedor" fields={{ id: supplier.id, ...fields }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="detail-block">
        <h3>Pagos del {periodName}</h3>
        {payments.length === 0 ? <p className="muted ledger-empty">Todavía no hay pagos a proveedores en este {periodName}.</p> : (
          <div className="table-wrap">
            <table className="balance-table">
              <thead><tr><th>FECHA</th><th>PROVEEDOR</th><th>CONCEPTO</th><th>MEDIO</th><th className="num">MONTO</th><th>ESTADO</th><th></th></tr></thead>
              <tbody>
                {payments.map((payment) => {
                  const next = payment.status === 'PAGADO' ? 'PENDIENTE' : 'PAGADO'
                  const supplierName = suppliers.find((supplier) => supplier.id === payment.supplier_id)?.name ?? 'Proveedor'
                  return (
                    <tr key={payment.id}>
                      <td>{formatDay(payment.paid_on)}</td>
                      <td>{supplierName}</td>
                      <td>{payment.concept}</td>
                      <td>
                        {METHODS[payment.method]}
                        {payment.method === 'ECHEQ' && <span className="row-note">Nº {payment.echeq_number}{payment.echeq_date ? ` · vence ${formatDay(payment.echeq_date)}` : ''}</span>}
                      </td>
                      <td className="num">{formatMoney(payment.amount)}</td>
                      <td>
                        <form action={setSupplierPaymentStatus}>
                          <BalanceReturn query={query} />
                          <input type="hidden" name="id" value={payment.id} />
                          <input type="hidden" name="status" value={next} />
                          <button className={`fixed-state ${payment.status === 'PAGADO' ? 'paid' : 'pending'}`} type="submit">
                            {payment.status === 'PAGADO' ? 'Pagado' : 'Pendiente'}
                          </button>
                        </form>
                      </td>
                      <td className="row-action"><DeleteButton action={deleteSupplierPayment} name={`el pago a ${supplierName}`} fields={{ id: payment.id, ...fields }} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <dialog
        ref={addDialog}
        className="company-dialog"
        onClick={(event) => {
          if (event.target === addDialog.current) addDialog.current?.close()
        }}
      >
        <div className="dialog-heading">
          <h2>Nuevo proveedor</h2>
          <button className="outline-button" type="button" onClick={() => addDialog.current?.close()}>Cerrar</button>
        </div>
        <form
          key={addKey}
          action={async (formData) => {
            try {
              await saveSupplier(formData)
            } finally {
              addDialog.current?.close()
            }
          }}
          className="balance-form dialog-form"
        >
          <BalanceReturn query={query} />
          <label className="field">Nombre<input name="name" placeholder="Verdulería Norte" required autoFocus /></label>
          <button className="primary-button" type="submit">Agregar</button>
        </form>
      </dialog>

      <dialog
        ref={payDialog}
        className="company-dialog payment-dialog"
        onClick={(event) => {
          if (event.target === payDialog.current) payDialog.current?.close()
        }}
      >
        <div className="dialog-heading">
          <h2>Anotar pago</h2>
          <button className="outline-button" type="button" onClick={() => payDialog.current?.close()}>Cerrar</button>
        </div>
        <SupplierPaymentForm
          key={payKey}
          suppliers={active}
          defaultDate={defaultDate}
          query={query}
          stacked
          defaultSupplierId={supplierId}
          onDone={() => payDialog.current?.close()}
        />
      </dialog>
    </section>
  )
}
