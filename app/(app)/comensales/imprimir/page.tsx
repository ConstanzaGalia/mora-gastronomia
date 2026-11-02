import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DinerPrintButton } from '@/components/diner-print-button'
import { DinerTable } from '@/components/diner-table'
import { dinerPeopleFilter, loadDiners } from '@/lib/diners'
import { formatLongDate } from '@/lib/format'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function ComensalesPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; empresa?: string; personas?: string }>
}) {
  const { fecha, empresa, personas: personasParam } = await searchParams
  const session = await requireSession()
  assertRole(session, ['COMPANY_ADMIN', 'ORG_ADMIN', 'SPACE_ADMIN'])
  if (session.primary.role !== 'COMPANY_ADMIN') assertViandasSpace(session)
  const isCompanyAdmin = session.primary.role === 'COMPANY_ADMIN'
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound()
  const companyId = isCompanyAdmin ? session.companyId : empresa
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

  const personas = dinerPeopleFilter(personasParam)
  const report = await loadDiners(supabase, company.id, fecha, personas)
  const backQuery = new URLSearchParams({ fecha, personas })
  if (!isCompanyAdmin) backQuery.set('empresa', company.id)
  const backHref = `/comensales?${backQuery.toString()}`

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
          </div>
        </header>
        <DinerTable categories={report.categories} diners={report.diners} groups={report.groups} />
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
