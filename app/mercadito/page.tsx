import Image from 'next/image'
import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { MarketOrderForm } from '@/components/market-order-form'
import { formatLongDate } from '@/lib/format'
import { loadMarketDay } from '@/lib/market'

export const metadata = { title: 'Mercadito · Mora Gastronomía' }

export default async function MercaditoPage() {
  const catalog = await loadMarketDay()
  const dateLabel = catalog ? formatLongDate(catalog.serviceDate) : ''
  const when = catalog?.focusLabel === 'hoy' ? 'de hoy' : 'de mañana'

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
        <p className="eyebrow">PEDIDO DEL DÍA</p>
        <h1>Menú {when}</h1>
        <p className="muted">
          {dateLabel ? `${dateLabel}. ` : ''}
          Elegí cantidades, poné dónde lo llevamos y cómo pagás.
          {catalog?.settings.deliveryNote ? ` ${catalog.settings.deliveryNote}` : ''}
        </p>
        {!catalog ? (
          <EmptyState title="El mercadito no está disponible" description="Volvé más tarde o escribinos por WhatsApp." />
        ) : !catalog.settings.enabled ? (
          <EmptyState title="Hoy no estamos tomando pedidos por acá" description="El menú corporativo sigue igual. Este canal está pausado." />
        ) : !catalog.published || catalog.groups.length === 0 ? (
          <EmptyState title={`No hay menú publicado ${when}`} description="Cuando Mora publique la semana, las opciones del día van a aparecer acá." />
        ) : (
          <MarketOrderForm serviceDate={catalog.serviceDate} groups={catalog.groups} settings={catalog.settings} />
        )}
      </div>
    </main>
  )
}
