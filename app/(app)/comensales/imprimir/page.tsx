import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DinerPrintButton } from '@/components/diner-print-button'
import { DinerTable } from '@/components/diner-table'
import { dinerPeopleFilter, loadDiners } from '@/lib/diners'
import { assertAccessView, resolveScopedCompanyId } from '@/lib/access'
import { formatLongDate } from '@/lib/format'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function ComensalesPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; empresa?: string; personas?: string; turno?: string; sector?: string }>
}) {
  const { fecha, empresa, personas: personasParam, turno, sector } = await searchParams
  const session = await requireSession()
  assertRole(session, ['COMPANY_ADMIN', 'ORG_ADMIN', 'SPACE_ADMIN', 'SCOPED'])
  assertAccessView(session, 'comensales')
  if (session.primary.role !== 'COMPANY_ADMIN') assertViandasSpace(session)
  const isCompanyAdmin = session.primary.role === 'COMPANY_ADMIN'
  const isScoped = session.primary.role === 'SCOPED'
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound()
  const companyId = isCompanyAdmin
    ? session.companyId
    : isScoped
      ? resolveScopedCompanyId(session, empresa)
      : empresa
  if (!companyId) notFound()

  const supabase = await createClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, nombre_comercial')
    .eq('id', companyId)
    .eq('business_space_id', session.spaceId)
    .eq('active', true)
    .maybeSingle()
  if (!company) notFound()
  if (isScoped && !session.accessCompanyIds.includes(company.id)) notFound()

  const personas = dinerPeopleFilter(personasParam)
  
  // Parsear filtros
  const mealShiftFilter = turno === 'MORNING' || turno === 'AFTERNOON' ? turno : null
  const sectorFilter = sector && sector !== 'todos' ? sector : null
  
  const report = await loadDiners(supabase, company.id, fecha, personas, mealShiftFilter, sectorFilter)
  const backQuery = new URLSearchParams({ fecha, personas })
  if (!isCompanyAdmin) backQuery.set('empresa', company.id)
  if (turno) backQuery.set('turno', turno)
  if (sector && sector !== 'todos') backQuery.set('sector', sector)
  const backHref = `/comensales?${backQuery.toString()}`
  
  // Generar título con filtros aplicados
  const filterLabels: string[] = []
  if (turno === 'MORNING') filterLabels.push('Turno mañana')
  if (turno === 'AFTERNOON') filterLabels.push('Turno tarde')
  if (sector && sector !== 'todos') {
    if (sector === 'sin-sector') {
      filterLabels.push('Sin sector')
    } else {
      const sectorData = await supabase
        .from('company_sectors')
        .select('name')
        .eq('id', sector)
        .maybeSingle()
      if (sectorData.data) filterLabels.push(sectorData.data.name)
    }
  }

  return (
    <div className="diner-print">
      <div className="diner-toolbar">
        <Link className="text-button" href={backHref}>Volver al informe</Link>
        <DinerPrintButton />
      </div>
      <article className="diner-sheet">
        <header className="diner-letterhead">
          <div className="diner-brand">
            <Image src="/brand/mora-logo.png" alt="Mora Gastronomía" width={44} height={44} className="brand-logo" />
            <div>
              <strong>Mora</strong>
              <span>Gastronomía</span>
            </div>
          </div>
          <div>
            <h1>{formatLongDate(fecha)}</h1>
            <p>{company.nombre_comercial}</p>
            {filterLabels.length > 0 && (
              <p className="muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {filterLabels.join(' · ')}
              </p>
            )}
          </div>
        </header>
        <DinerTable
          categories={report.categories}
          diners={report.diners}
          groups={report.groups}
          showMealShift={report.mealShiftsEnabled}
        />
        {report.diners.length === 0 && (
          <p className="muted">
            {personas === 'pidieron'
              ? 'Nadie pidió para esta empresa en esa fecha.'
              : 'No hay personas activas en esa fecha.'}
          </p>
        )}
      </article>
    </div>
  )
}
