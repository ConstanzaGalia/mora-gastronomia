import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DinerCalendar } from '@/components/diner-calendar'
import { DinerTable } from '@/components/diner-table'
import { EmptyState } from '@/components/empty-state'
import { FilterForm } from '@/components/filter-form'
import { PageHeader } from '@/components/page-header'
import { loadDiners } from '@/lib/diners'
import { businessToday } from '@/lib/format'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function ComensalesPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; empresa?: string }>
}) {
  const { fecha, empresa } = await searchParams
  const session = await requireSession()
  assertRole(session, ['COMPANY_ADMIN', 'ORG_ADMIN', 'SPACE_ADMIN'])
  if (session.primary.role !== 'COMPANY_ADMIN') assertViandasSpace(session)
  const date = validDate(fecha) ?? businessToday()
  const supabase = await createClient()
  const isCompanyAdmin = session.primary.role === 'COMPANY_ADMIN'
  const companies = isCompanyAdmin
    ? []
    : (await supabase
        .from('companies')
        .select('id, nombre_comercial')
        .eq('business_space_id', session.spaceId)
        .eq('active', true)
        .order('nombre_comercial')).data ?? []

  const companyId = isCompanyAdmin ? session.companyId : companies.find((company) => company.id === empresa)?.id ?? companies[0]?.id ?? null
  if (!companyId) {
    return (
      <>
        <PageHeader eyebrow="COMENSALES" title="Informe del día" description="Elegí una empresa para ver qué pidió cada persona." />
        <EmptyState title="No hay empresas activas" description="Cuando haya una empresa en el espacio, el informe aparece acá." />
      </>
    )
  }

  const companyName = isCompanyAdmin
    ? (await supabase.from('companies').select('nombre_comercial').eq('id', companyId).maybeSingle()).data?.nombre_comercial ?? 'Tu empresa'
    : companies.find((company) => company.id === companyId)?.nombre_comercial ?? ''
  if (!isCompanyAdmin && !companies.some((company) => company.id === companyId)) notFound()

  const report = await loadDiners(supabase, companyId, date)
  const printHref = `/comensales/imprimir?fecha=${date}&empresa=${companyId}`

  return (
    <>
      <PageHeader
        eyebrow="COMENSALES"
        title={companyName}
        description={report.groups
          ? 'Agrupado por sector. Dentro de cada sector, por apellido. Cada columna es una categoría contratada.'
          : 'Ordenado por apellido y nombre. Cada columna es una categoría que la empresa tiene contratada.'}
        action={<Link className="primary-button" href={printHref}>Exportar PDF</Link>}
      />
      {!isCompanyAdmin && (
        <FilterForm className="form-row">
          <input type="hidden" name="fecha" value={date} />
          <label className="field">
            Empresa
            <select name="empresa" defaultValue={companyId}>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.nombre_comercial}</option>)}
            </select>
          </label>
        </FilterForm>
      )}
      <DinerCalendar date={date} empresa={isCompanyAdmin ? undefined : companyId} />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Empleados</h2>
            <p className="muted">{report.diners.length === 1 ? '1 empleado' : `${report.diners.length} empleados`}</p>
          </div>
        </div>
        {report.diners.length === 0 ? <EmptyState title="No hay empleados activos" description="Las personas activas de la empresa en esa fecha aparecen acá." /> : (
          <DinerTable categories={report.categories} diners={report.diners} groups={report.groups} />
        )}
      </section>
    </>
  )
}

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}
