'use client'

import Image from 'next/image'
import { useActionState, useMemo, useState } from 'react'
import { placeMarketOrder } from '@/lib/actions/market'
import { digits, formatMoney } from '@/lib/format'
import {
  hasTransferDetails,
  MARKET_OFFER,
  splitMarketMenu,
  transferLines,
  type MarketGroup,
  type MarketSettings,
} from '@/lib/market'

const STEPS = [
  { id: 1, label: 'Menú' },
  { id: 2, label: 'Entrega' },
  { id: 3, label: 'Pago' },
] as const

const PRODUCT_PHOTOS = ['/landing/hero.jpg', '/landing/about.jpg']

export function MarketOrderForm({
  serviceDate,
  groups,
  settings,
}: {
  serviceDate: string
  groups: MarketGroup[]
  settings: MarketSettings
}) {
  const { trays } = splitMarketMenu(groups)
  const [state, action, pending] = useActionState(placeMarketOrder, { error: '' })
  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [payment, setPayment] = useState<'EFECTIVO' | 'TRANSFERENCIA'>('EFECTIVO')
  const [hint, setHint] = useState('')

  function submitOrder(formData: FormData) {
    formData.set('payment_method', payment)
    action(formData)
  }
  const unitPrice = settings.unitPrice ?? 0

  const selected = useMemo(
    () => (trays?.options ?? [])
      .map((option) => ({ option, quantity: quantities[option.id] ?? 0 }))
      .filter((row) => row.quantity > 0),
    [trays, quantities],
  )
  const totalQty = selected.reduce((sum, row) => sum + row.quantity, 0)
  const total = totalQty * unitPrice
  const details = transferLines(settings)
  const canPay = totalQty > 0 && unitPrice > 0

  function setQuantity(id: string, value: number) {
    const next = Math.max(0, Math.min(20, Math.floor(value)))
    setQuantities((current) => ({ ...current, [id]: next }))
  }

  function openStep(id: number) {
    setHint('')
    setStep(id)
    setMaxStep((current) => Math.max(current, id))
  }

  function goNext() {
    if (step === 1) {
      if (!canPay) {
        setHint('Elegí al menos una bandeja.')
        return
      }
      openStep(2)
      return
    }
    if (name.trim().length < 2) {
      setHint('Poné tu nombre.')
      return
    }
    if (digits(phone).length < 8) {
      setHint('Poné un teléfono para coordinar el envío.')
      return
    }
    if (address.trim().length < 6) {
      setHint('Poné la dirección de entrega.')
      return
    }
    openStep(3)
  }

  function goTo(id: number) {
    if (id > maxStep || id === step) return
    setHint('')
    setStep(id)
  }

  const stepNavProps = {
    step,
    pending,
    canPay,
    total,
    payment,
    onBack: () => goTo(step - 1),
    onNext: goNext,
  }

  return (
    <form
      action={submitOrder}
      className="market-form market-checkout"
      onSubmit={(event) => {
        if (step < 3) event.preventDefault()
      }}
    >
      <input type="hidden" name="service_date" value={serviceDate} />
      <div className="market-checkout-main">
        <ol className="market-steps">
          {STEPS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={step === item.id ? 'is-on' : item.id <= maxStep ? 'is-done' : ''}
                onClick={() => goTo(item.id)}
                disabled={item.id > maxStep}
                aria-current={step === item.id ? 'step' : undefined}
                aria-label={item.id < step ? `Volver a ${item.label}` : item.label}
              >
                <small>Paso {item.id}</small>
                <strong>{item.label}</strong>
              </button>
            </li>
          ))}
        </ol>

        <section className="panel" hidden={step !== 1}>
          <div className="panel-heading">
            <div>
              <h2>Elegí tu bandeja</h2>
              <p className="muted">{MARKET_OFFER}.</p>
            </div>
          </div>
          <div className="market-products">
            {(trays?.options ?? []).map((option, index) => {
              const quantity = quantities[option.id] ?? 0
              return (
                <article className={`market-product${quantity > 0 ? ' is-picked' : ''}`} key={option.id}>
                  <div className="market-product-photo">
                    <Image src={PRODUCT_PHOTOS[index % PRODUCT_PHOTOS.length]} alt="" fill sizes="72px" />
                  </div>
                  <div className="market-product-copy">
                    <strong>{option.name}</strong>
                    <small>Envío a domicilio gratis</small>
                    {unitPrice > 0 && <b>{formatMoney(unitPrice)}</b>}
                  </div>
                  <input type="hidden" name={`qty_${option.id}`} value={quantity} />
                  <QtyStepper name={option.name} quantity={quantity} onChange={(value) => setQuantity(option.id, value)} />
                </article>
              )
            })}
          </div>
          {step === 1 && <StepNav {...stepNavProps} />}
        </section>

        <section className="panel" hidden={step !== 2}>
          <div className="market-step-media">
            <Image src="/landing/delivery.jpg" alt="Entrega de viandas Mora" fill sizes="(min-width:900px) 640px, 100vw" />
          </div>
          <div className="panel-heading">
            <div>
              <h2>Dónde lo llevamos</h2>
              <p className="muted">El envío está incluido. Coordinamos por WhatsApp si hace falta.</p>
            </div>
          </div>
          <div className="stack-form">
            <label className="field">Nombre y apellido<input name="customer_name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="field">Teléfono<input name="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <label className="field">Dirección de entrega<input name="address" autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
            <label className="field">Nota (opcional)<textarea name="notes" rows={2} placeholder="Timbre, horario, sin cebolla…" /></label>
            {settings.deliveryNote && <p className="muted">{settings.deliveryNote}</p>}
          </div>
          {step === 2 && <StepNav {...stepNavProps} />}
        </section>

        <section className="panel" hidden={step !== 3}>
          <div className="panel-heading">
            <div>
              <h2>Cómo pagás</h2>
              <p className="muted">Si transferís, en el siguiente paso te abrimos WhatsApp para avisar el pedido y mandar el comprobante.</p>
            </div>
          </div>
          <div className="stack-form">
            <fieldset>
              <legend>Forma de pago</legend>
              <label className="check-line">
                <input
                  type="radio"
                  name="payment_choice"
                  value="EFECTIVO"
                  checked={payment === 'EFECTIVO'}
                  onChange={() => setPayment('EFECTIVO')}
                />
                Efectivo al recibir
              </label>
              <label className="check-line">
                <input
                  type="radio"
                  name="payment_choice"
                  value="TRANSFERENCIA"
                  checked={payment === 'TRANSFERENCIA'}
                  onChange={() => setPayment('TRANSFERENCIA')}
                />
                Transferencia
              </label>
            </fieldset>
            {payment === 'TRANSFERENCIA' && (
              <div className="market-transfer">
                <strong>Transferí a estos datos</strong>
                {hasTransferDetails(settings) ? (
                  <ul>
                    {details.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                ) : (
                  <p>Después del pedido te pasamos alias y CBU por WhatsApp.</p>
                )}
                <p>En el siguiente paso te abrimos WhatsApp para avisarle a Mora. Ahí mandás el comprobante.</p>
              </div>
            )}
            {payment === 'EFECTIVO' && (
              <p className="muted">Pagás cuando te lo llevemos. No hace falta seña.</p>
            )}
          </div>
          {step === 3 && <StepNav {...stepNavProps} />}
        </section>

        {(hint || state.error) && <p className="error-banner">{hint || state.error}</p>}
      </div>

      <aside className="panel market-summary">
        <div className="panel-heading">
          <h2>Tu pedido</h2>
        </div>
        {totalQty === 0 ? (
          <p className="muted">Elegí las bandejas para ver el total.</p>
        ) : (
          <div className="market-cart-list">
            {selected.map((row) => (
              <div className="market-cart-item" key={row.option.id}>
                <div className="market-cart-copy">
                  <strong>{row.option.name}</strong>
                  <span>{formatMoney(row.quantity * unitPrice)}</span>
                </div>
                <QtyStepper name={row.option.name} quantity={row.quantity} onChange={(value) => setQuantity(row.option.id, value)} />
              </div>
            ))}
            <div className="market-cart-item">
              <span>Envío a domicilio</span>
              <strong>Gratis</strong>
            </div>
            <div className="market-cart-item market-summary-total">
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          </div>
        )}
        <StepNav {...stepNavProps} />
      </aside>
    </form>
  )
}

function StepNav({
  step,
  pending,
  canPay,
  total,
  payment,
  onBack,
  onNext,
}: {
  step: number
  pending: boolean
  canPay: boolean
  total: number
  payment: 'EFECTIVO' | 'TRANSFERENCIA'
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="market-step-actions">
      {step > 1 && (
        <button className="outline-button" type="button" onClick={onBack}>
          {step === 2 ? 'Volver al menú' : 'Volver a entrega'}
        </button>
      )}
      {step < 3 ? (
        <button className="primary-button" type="button" onClick={onNext} disabled={pending}>
          {step === 1 ? 'Continuar a entrega' : 'Continuar a pago'}
        </button>
      ) : (
        <button className="primary-button" type="submit" name="payment_method" value={payment} disabled={pending || !canPay}>
          {pending ? 'Enviando…' : `Pedir · ${formatMoney(total)}`}
        </button>
      )}
    </div>
  )
}

function QtyStepper({ name, quantity, onChange }: { name: string; quantity: number; onChange: (value: number) => void }) {
  return (
    <div className="extras-stepper">
      <button type="button" aria-label={`Restar ${name}`} onClick={() => onChange(quantity - 1)}>−</button>
      <input
        type="number"
        min={0}
        max={20}
        inputMode="numeric"
        value={quantity}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={`Cantidad de ${name}`}
      />
      <button type="button" aria-label={`Sumar ${name}`} onClick={() => onChange(quantity + 1)}>+</button>
    </div>
  )
}
