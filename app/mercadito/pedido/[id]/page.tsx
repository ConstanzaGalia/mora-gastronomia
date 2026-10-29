import Image from 'next/image'
import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { MarketThanks } from '@/components/market-thanks'
import { formatLongDate } from '@/lib/format'
import { loadMarketOrder } from '@/lib/market'

export default async function MarketOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await loadMarketOrder(id)

  return (
    <main className="market-page">
      <header className="market-top">
        <Link className="brand" href="/mercadito">
          <Image src="/brand/mora-logo.png" alt="Mora Gastronomía" width={40} height={40} className="brand-logo" />
          <div><strong>Mora</strong><span>Mercadito</span></div>
        </Link>
        <Link className="outline-button" href="/mercadito">Nuevo pedido</Link>
      </header>
      <div className="market-wrap">
        {!result ? (
          <EmptyState title="No encontramos ese pedido" description="Si recargaste mucho después, armá uno nuevo desde el mercadito." />
        ) : (
          <>
            <p className="eyebrow">PEDIDO TOMADO</p>
            <h1>Gracias, {result.order.customerName.split(' ')[0]}</h1>
            <p className="muted">Pedido para el {formatLongDate(result.order.serviceDate)}.</p>
            <MarketThanks order={result.order} settings={result.settings} />
          </>
        )}
      </div>
    </main>
  )
}
