'use client'

import { useActionState, useMemo, useState } from 'react'
import { placeMarketOrder } from '@/lib/actions/market'
import { formatMoney } from '@/lib/format'
import {
  hasTransferDetails,
  transferLines,
  type MarketGroup,
  type MarketSettings,
} from '@/lib/market'

export function MarketOrderForm({
  serviceDate,
  groups,
  settings,
}: {
  serviceDate: string
  groups: MarketGroup[]
  settings: MarketSettings
}) {
  const [state, action, pending] = useActionState(placeMarketOrder, { error: '' })
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [payment, setPayment] = useState<'EFECTIVO' | 'TRANSFERENCIA'>('EFECTIVO')
  const unitPrice = settings.unitPrice ?? 0

  const selected = useMemo(
    () => groups.flatMap((group) => group.options
      .map((option) => ({ group, option, quantity: quantities[option.id] ?? 0 }))
      .filter((row) => row.quantity > 0)),
    [groups, quantities],
  )
  const totalQty = selected.reduce((sum, row) => sum + row.quantity, 0)
  const total = totalQty * unitPrice
  const details = transferLines(settings)

  function setQuantity(id: string, value: number) {
    const next = Math.max(0, Math.min(20, Math.floor(value)))
    setQuantities((current) => ({ ...current, [id]: next }))
  }

  return (
    <form action={action} className="market-form">
      <input type="hidden" name="service_date" value={serviceDate} />
      {groups.map((group) => (
        <section className="panel market-group" key={group.id}>
          <div className="panel-heading">
            <h2>{group.name}</h2>
            {unitPrice > 0 && <p className="muted">{formatMoney(unitPrice)} c/u</p>}
          </div>
          {group.options.map((option) => {
            const quantity = quantities[option.id] ?? 0
            return (
              <label className="extras-row" key={option.id}>
                <span>{option.name}</span>
                <input type="hidden" name={`qty_${option.id}`} value={quantity} />
                <div className="extras-stepper">
                  <button type="button" aria-label={`Restar ${option.name}`} onClick={() => setQuantity(option.id, quantity - 1)}>−</button>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    inputMode="numeric"
                    value={quantity}
                    onChange={(event) => setQuantity(option.id, Number(event.target.value))}
                    aria-label={`Cantidad de ${option.name}`}
                  />
                  <button type="button" aria-label={`Sumar ${option.name}`} onClick={() => setQuantity(option.id, quantity + 1)}>+</button>
                </div>
              </label>
            )
          })}
        </section>
      ))}

      <section className="panel">
        <div className="panel-heading">
          <h2>Tus datos</h2>
        </div>
        <div className="stack-form">
          <label className="field">Nombre y apellido<input name="customer_name" autoComplete="name" required /></label>
          <label className="field">Teléfono<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required /></label>
          <label className="field">Dirección de entrega<input name="address" autoComplete="street-address" required /></label>
          <label className="field">Nota (opcional)<textarea name="notes" rows={2} placeholder="Timbre, horario, sin cebolla…" /></label>
          <fieldset>
            <legend>Forma de pago</legend>
            <label className="check-line">
              <input
                type="radio"
                name="payment_method"
                value="EFECTIVO"
                checked={payment === 'EFECTIVO'}
                onChange={() => setPayment('EFECTIVO')}
              />
              Efectivo al recibir
            </label>
            <label className="check-line">
              <input
                type="radio"
                name="payment_method"
                value="TRANSFERENCIA"
                checked={payment === 'TRANSFERENCIA'}
                onChange={() => {
                  setPayment('TRANSFERENCIA')
                  window.requestAnimationFrame(() => {
                    document.querySelector('.market-transfer')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                  })
                }}
              />
              Transferencia
            </label>
          </fieldset>
          {payment === 'TRANSFERENCIA' && (
            <div className="market-transfer">
              <strong>Datos para transferir</strong>
              {hasTransferDetails(settings) ? (
                <ul>
                  {details.map((line) => <li key={line}>{line}</li>)}
                </ul>
              ) : (
                <p>Después del pedido te pasamos alias y CBU. Mandá el comprobante por WhatsApp.</p>
              )}
              <p>El pedido queda tomado y después mandás el comprobante por WhatsApp.</p>
            </div>
          )}
        </div>
      </section>

      {state.error && <p className="error-banner">{state.error}</p>}

      <div className="market-bar-bottom">
        <div>
          <small>{totalQty === 0 ? 'Elegí las cantidades' : `${totalQty} ${totalQty === 1 ? 'vianda' : 'viandas'}`}</small>
          <strong>{formatMoney(total)}</strong>
        </div>
        <button className="primary-button" type="submit" disabled={pending || totalQty === 0}>
          {pending ? 'Enviando…' : 'Hacer pedido'}
        </button>
      </div>
    </form>
  )
}
