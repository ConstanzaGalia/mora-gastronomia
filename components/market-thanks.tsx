'use client'

import Image from 'next/image'
import { useState } from 'react'
import { formatMoney } from '@/lib/format'
import {
  billedMarketItems,
  hasTransferDetails,
  marketWhatsappHref,
  MARKET_PAYMENT_LABEL,
  orderWhatsappMessage,
  transferLines,
  type MarketOrder,
  type MarketSettings,
} from '@/lib/market'

export function MarketThanks({ order, settings }: { order: MarketOrder; settings: MarketSettings }) {
  const transfer = order.paymentMethod === 'TRANSFERENCIA'
  const details = transferLines(settings)
  const href = marketWhatsappHref(settings, orderWhatsappMessage(order, settings))
  const items = billedMarketItems(order.items)

  return (
    <div className="market-thanks">
      <section className="panel">
        <div className="market-step-media">
          <Image src="/landing/hero.jpg" alt="Viandas de Mora" fill sizes="(min-width:720px) 720px, 100vw" />
        </div>
        <div className="panel-heading">
          <div>
            <h2>Pedido tomado</h2>
            <p className="muted">{order.customerName} · {order.phone}</p>
          </div>
        </div>
        <p>
          {order.afterCutoff
            ? 'El horario de ese día ya cerró. Quedó registrado y Mora te confirma por WhatsApp si puede sumarlo.'
            : 'Ya quedó registrado. Por WhatsApp le avisás a Mora para coordinar la entrega.'}
        </p>
        <p className="muted">{order.address}</p>
        <div className="chosen-list">
          {items.map((item) => (
            <p key={`${item.optionName}-${item.categoryName}`}>
              <span>{item.quantity} × {item.optionName}</span>
              <strong>{formatMoney(item.amount)}</strong>
            </p>
          ))}
          <p>
            <span>Envío a domicilio</span>
            <strong>Gratis</strong>
          </p>
          <p>
            <span>Total · {MARKET_PAYMENT_LABEL[order.paymentMethod]}</span>
            <strong>{formatMoney(order.total)}</strong>
          </p>
        </div>
      </section>

      {transfer && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Transferí y mandá el comprobante</h2>
          </div>
          {hasTransferDetails(settings) ? (
            <ul className="market-transfer-list">
              {details.map((line) => (
                <CopyLine key={line} line={line} />
              ))}
            </ul>
          ) : (
            <p className="muted">En el WhatsApp te pasamos alias y CBU. Adjuntá el comprobante en el mismo chat.</p>
          )}
        </section>
      )}

      <a className="primary-button market-whatsapp" href={href} rel="noopener noreferrer" target="_blank">
        {transfer ? 'Avisar a Mora y enviar el comprobante' : 'Avisarle a Mora por WhatsApp'}
      </a>
      {!transfer && <p className="muted">Pagás en efectivo cuando te lo llevemos.</p>}
    </div>
  )
}

function CopyLine({ line }: { line: string }) {
  const [copied, setCopied] = useState(false)
  const value = line.split(': ').slice(1).join(': ')
  const copyable = /^(Alias|CBU\/CVU):/.test(line)
  return (
    <li>
      <span>{line}</span>
      {copyable && value && (
        <button
          className="outline-button"
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      )}
    </li>
  )
}
