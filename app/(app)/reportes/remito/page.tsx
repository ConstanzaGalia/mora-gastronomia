import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DinerPrintButton } from '@/components/diner-print-button'
import { RemitoSheet } from '@/components/remito-sheet'
import { describeError } from '@/lib/format'
import { formatRemitoNumber } from '@/lib/remito'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function RemitoPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; empresa?: string }>
}) {
  const { fecha, empresa } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN', 'COMPANY_ADMIN'])
  if (session.primary.role !== 'COMPANY_ADMIN') assertViandasSpace(session)

  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound()
  const isCompanyAdmin = session.primary.role === 'COMPANY_ADMIN'
  const companyId = isCompanyAdmin ? session.companyId : empresa
  if (!companyId) notFound()

  const supabase = await createClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, nombre_comercial, razon_social, cuit, business_space_id')
    .eq('id', companyId)
    .eq('business_space_id', session.spaceId)
    .eq('active', true)
    .maybeSingle()
  if (!company) notFound()

  const { data: remitoId, error } = await supabase.rpc('get_or_create_remito', {
    p_company_id: company.id,
    p_service_date: fecha,
  })
  if (error || !remitoId) {
    return (
      <div className="remito-print">
        <div className="diner-toolbar">
          <Link className="text-button" href={backHref(fecha, isCompanyAdmin ? null : company.id)}>Volver a reportes</Link>
        </div>
        <p className="error-banner">{describeError(error)}</p>
      </div>
    )
  }

  const [{ data: remito }, { data: items }] = await Promise.all([
    supabase
      .from('remitos')
      .select('id, point_of_sale, folio, service_date')
      .eq('id', remitoId)
      .maybeSingle(),
    supabase
      .from('remito_items')
      .select('category_name, option_name, quantity, sort_order')
      .eq('remito_id', remitoId)
      .order('sort_order')
      .order('option_name'),
  ])
  if (!remito) notFound()

  const number = formatRemitoNumber(remito.point_of_sale, remito.folio)
  const lines = (items ?? []).map((item) => ({
    category_name: item.category_name,
    option_name: item.option_name,
    quantity: item.quantity,
    sort_order: item.sort_order,
  }))
  const sheetProps = {
    number,
    serviceDate: remito.service_date,
    companyName: company.nombre_comercial,
    razonSocial: company.razon_social,
    cuit: company.cuit,
    items: lines,
  }

  return (
    <div className="remito-print">
      <div className="diner-toolbar">
        <Link className="text-button" href={backHref(fecha, isCompanyAdmin ? null : company.id)}>Volver a reportes</Link>
        <DinerPrintButton />
      </div>
      <RemitoSheet {...sheetProps} copy="ORIGINAL" />
      <RemitoSheet {...sheetProps} copy="DUPLICADO" />
    </div>
  )
}

function backHref(fecha: string, empresa: string | null) {
  const query = new URLSearchParams({ fecha })
  if (empresa) query.set('empresa', empresa)
  return `/reportes?${query.toString()}`
}
