import Image from 'next/image'
import { formatLongDate } from '@/lib/format'
import { formatRemitoNumber, remitoBandejaTotal, type RemitoItem } from '@/lib/remito'

export function RemitoSheet({
  copy,
  number,
  serviceDate,
  companyName,
  razonSocial,
  cuit,
  items,
}: {
  copy: 'ORIGINAL' | 'DUPLICADO'
  number: string
  serviceDate: string
  companyName: string
  razonSocial: string | null
  cuit: string | null
  items: RemitoItem[]
}) {
  const bandejas = remitoBandejaTotal(items)
  const [year, month, day] = serviceDate.slice(0, 10).split('-')

  return (
    <article className="remito-sheet">
      <header className="remito-letterhead">
        <div className="remito-brand">
          <Image src="/brand/mora-logo.png" alt="Viandas Morá Empresariales" width={56} height={56} className="brand-logo" />
          <div>
            <span className="remito-brand-eyebrow">Viandas</span>
            <strong>Morá</strong>
            <span className="remito-brand-sub">Empresariales</span>
          </div>
        </div>
        <div className="remito-doc">
          <div className="remito-doc-top">
            <span className="remito-x" aria-hidden>X</span>
            <div>
              <p className="remito-number">Nº {number}</p>
              <p className="remito-type">Comprobante · REMITO</p>
            </div>
          </div>
          <p className="remito-date">
            <span>Fecha</span>
            <strong>{day}/{month}/{year}</strong>
          </p>
        </div>
      </header>

      <section className="remito-party">
        <p><span>Señor(es)</span><strong>{companyName}</strong></p>
        {razonSocial ? <p><span>Razón social</span><strong>{razonSocial}</strong></p> : null}
        {cuit ? <p><span>CUIT</span><strong>{cuit}</strong></p> : null}
        <p className="remito-party-date muted">{formatLongDate(serviceDate)}</p>
      </section>

      <table className="remito-table">
        <thead>
          <tr>
            <th className="remito-qty">Cant.</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={2} className="muted">Sin cantidades para esta fecha.</td>
            </tr>
          ) : items.map((item) => (
            <tr key={`${item.category_name}-${item.option_name}`}>
              <td className="remito-qty">{item.quantity}</td>
              <td>
                <strong>{item.option_name}</strong>
                <span className="remito-cat">{item.category_name}</span>
              </td>
            </tr>
          ))}
        </tbody>
        {bandejas > 0 ? (
          <tfoot>
            <tr>
              <td className="remito-qty">{bandejas}</td>
              <td>Total bandejas</td>
            </tr>
          </tfoot>
        ) : null}
      </table>

      <footer className="remito-footer">
        <div className="remito-signs">
          <p><span>Firma</span></p>
          <p><span>Aclaración</span></p>
        </div>
        <p className="remito-copy">{copy}</p>
      </footer>
    </article>
  )
}
