import Image from 'next/image'
import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { MarketOrderForm } from '@/components/market-order-form'
import { formatLongDate, formatMoney } from '@/lib/format'
import { loadMarketDay, MARKET_OFFER, splitMarketMenu } from '@/lib/market'

export const metadata = { title: 'Mercadito · Mora Gastronomía' }

export default async function MercaditoPage() {
  const catalog = await loadMarketDay()
  const dateLabel = catalog ? formatLongDate(catalog.serviceDate) : ''
  const when = catalog?.focusLabel === 'hoy' ? 'de hoy' : 'de mañana'
  const price = catalog?.settings.unitPrice

  return (
    <main className="market-page">
      <header className="market-top">
        <Link className="brand" href="/">
          <Image src="/brand/mora-logo.png" alt="Mora Gastronomía" width={40} height={40} className="brand-logo" priority />
          <div><strong>Mora</strong><span>Mercadito</span></div>
        </Link>
        <Link className="outline-button" href="/login">Ingresar</Link>
      </header>
      <div className="market-wrap">
        <section className="market-cover">
          <Image src="/landing/about.jpg" alt="Vianda de Mora Gastronomía" fill sizes="(min-width:980px) 980px, 100vw" priority />
          <div className="market-cover-shade" />
          <div className="market-cover-copy">
            <p className="eyebrow">PEDIDO DEL DÍA</p>
            <h1>Menú {when}</h1>
            <p>{dateLabel ? `${dateLabel}. ` : ''}{MARKET_OFFER}.</p>
            {price != null && price > 0 && <strong className="market-cover-price">{formatMoney(price)} <span>por bandeja</span></strong>}
          </div>
        </section>
        {!catalog ? (
          <EmptyState title="El mercadito no está disponible" description="Volvé más tarde o escribinos por WhatsApp." />
        ) : !catalog.settings.enabled ? (
          <EmptyState title="Hoy no estamos tomando pedidos por acá" description="El menú corporativo sigue igual. Este canal está pausado." />
        ) : !catalog.published || !splitMarketMenu(catalog.groups).trays?.options.length ? (
          <EmptyState title={`No hay bandejas publicadas ${when}`} description="Cuando Mora publique el menú del día, las bandejas van a aparecer acá." />
        ) : (
          <MarketOrderForm serviceDate={catalog.serviceDate} groups={catalog.groups} settings={catalog.settings} />
        )}
      </div>
    </main>
  )
}
