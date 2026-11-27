import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DinerPrintButton } from '@/components/diner-print-button'
import { RemitoSheet } from '@/components/remito-sheet'
import { assertAccessView, resolveScopedCompanyId } from '@/lib/access'
import { describeError } from '@/lib/format'
import { formatRemitoNumber } from '@/lib/remito'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function RemitoPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; empresa?: string; turno?: string; sector?: string }>
}) {
  const { fecha, empresa, turno, sector } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN', 'COMPANY_ADMIN', 'SCOPED'])
  assertAccessView(session, 'reportes')
  if (session.primary.role !== 'COMPANY_ADMIN') assertViandasSpace(session)

  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound()
  const isCompanyAdmin = session.primary.role === 'COMPANY_ADMIN'
  const isScoped = session.primary.role === 'SCOPED'
  const companyId = isCompanyAdmin
    ? session.companyId
    : isScoped
      ? resolveScopedCompanyId(session, empresa)
      : empresa
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
  if (isScoped && !session.accessCompanyIds.includes(company.id)) notFound()

  const { data: remitoId, error } = await supabase.rpc('get_or_create_remito', {
    p_company_id: company.id,
    p_service_date: fecha,
  })
  if (error || !remitoId) {
    return (
      <div className="remito-print">
        <div className="diner-toolbar">
          <Link className="text-button" href={backHref(fecha, isCompanyAdmin ? null : company.id, turno, sector)}>Volver a reportes</Link>
        </div>
        <p className="error-banner">{describeError(error)}</p>
      </div>
    )
  }

  // Construir query para items con filtros opcionales
  let itemsQuery = supabase
    .from('remito_items')
    .select('category_name, option_name, quantity, sort_order, meal_shift')
    .eq('remito_id', remitoId)
  
  // Aplicar filtro de turno si existe
  if (turno === 'MORNING' || turno === 'AFTERNOON') {
    itemsQuery = itemsQuery.eq('meal_shift', turno)
  }
  
  const [{ data: remito }, { data: items }] = await Promise.all([
    supabase
      .from('remitos')
      .select('id, point_of_sale, folio, service_date')
      .eq('id', remitoId)
      .maybeSingle(),
    itemsQuery
      .order('meal_shift', { nullsFirst: false })
      .order('sort_order')
      .order('option_name'),
  ])
  if (!remito) notFound()

  const number = formatRemitoNumber(remito.point_of_sale, remito.folio)
  let lines = (items ?? []).map((item) => ({
    category_name: item.category_name,
    option_name: item.option_name,
    quantity: item.quantity,
    sort_order: item.sort_order,
    meal_shift: item.meal_shift as 'MORNING' | 'AFTERNOON' | null,
  }))
  
  // Si hay filtro de sector, necesitamos filtrar por las personas de ese sector
  if (sector && sector !== 'todos') {
    const { data: sectorMembers } = sector === 'sin-sector'
      ? await supabase
          .from('memberships')
          .select('user_id')
          .eq('company_id', company.id)
          .is('sector_id', null)
          .eq('status', 'ACTIVE')
      : await supabase
          .from('memberships')
          .select('user_id')
          .eq('company_id', company.id)
          .eq('sector_id', sector)
          .eq('status', 'ACTIVE')
    
    const memberIds = (sectorMembers ?? []).map(m => m.user_id)
    
    // Obtener las selecciones de esos miembros
    const { data: selections } = await supabase
      .from('v_selection_details')
      .select('category_name, option_name')
      .eq('service_date', fecha)
      .eq('company_id', company.id)
      .in('employee_id', memberIds)
      .eq('status', 'SUBMITTED')
    
    // Contar las opciones por categoría y opción
    const counts = new Map<string, number>()
    for (const sel of selections ?? []) {
      const key = `${sel.category_name}|${sel.option_name}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    
    // Filtrar las líneas para incluir solo las que coinciden con este sector
    lines = lines
      .map(line => {
        const key = `${line.category_name}|${line.option_name}`
        const qty = counts.get(key) ?? 0
        return { ...line, quantity: qty }
      })
      .filter(line => line.quantity > 0)
  }
  // Generar subtítulo con filtros aplicados
  const filterLabels: string[] = []
  if (turno === 'MORNING') filterLabels.push('Turno mañana')
  if (turno === 'AFTERNOON') filterLabels.push('Turno tarde')
  if (sector && sector !== 'todos') {
    if (sector === 'sin-sector') {
      filterLabels.push('Sin sector')
    } else {
      const { data: sectorData } = await supabase
        .from('company_sectors')
        .select('name')
        .eq('id', sector)
        .maybeSingle()
      if (sectorData) filterLabels.push(sectorData.name)
    }
  }
  
  const sheetProps = {
    number,
    serviceDate: remito.service_date,
    companyName: company.nombre_comercial,
    razonSocial: company.razon_social,
    cuit: company.cuit,
    items: lines,
    filterLabel: filterLabels.length > 0 ? filterLabels.join(' · ') : undefined,
  }

  return (
    <div className="remito-print">
      <div className="diner-toolbar">
        <Link className="text-button" href={backHref(fecha, isCompanyAdmin ? null : company.id, turno, sector)}>Volver a reportes</Link>
        <DinerPrintButton />
      </div>
      <RemitoSheet {...sheetProps} copy="ORIGINAL" />
      <RemitoSheet {...sheetProps} copy="DUPLICADO" />
    </div>
  )
}

function backHref(fecha: string, empresa: string | null, turno?: string, sector?: string) {
  const query = new URLSearchParams({ fecha })
  if (empresa) query.set('empresa', empresa)
  if (turno) query.set('turno', turno)
  if (sector && sector !== 'todos') query.set('sector', sector)
  return `/reportes?${query.toString()}`
}
