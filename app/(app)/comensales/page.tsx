import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DinerCalendar } from '@/components/diner-calendar'
import { DinerTable } from '@/components/diner-table'
import { EmptyState } from '@/components/empty-state'
import { FilterForm } from '@/components/filter-form'
import { PageHeader } from '@/components/page-header'
import { assertAccessView, canPickCompany, hasAccessView, resolveScopedCompanyId } from '@/lib/access'
import { dinerPeopleFilter, loadDiners } from '@/lib/diners'
import { businessToday } from '@/lib/format'
import { loadExtras } from '@/lib/kitchen'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function ComensalesPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; empresa?: string; personas?: string; error?: string }>
}) {
  const { fecha, empresa, personas: personasParam, error } = await searchParams
  const session = await requireSession()
  assertRole(session, ['COMPANY_ADMIN', 'ORG_ADMIN', 'SPACE_ADMIN', 'SCOPED'])
  assertAccessView(session, 'comensales')
  if (session.primary.role !== 'COMPANY_ADMIN') assertViandasSpace(session)
  const date = validDate(fecha) ?? businessToday()
  const supabase = await createClient()
  const isCompanyAdmin = session.primary.role === 'COMPANY_ADMIN'
  const isScoped = session.primary.role === 'SCOPED'
  const showCompanyFilter = canPickCompany(session)
  const companies = isCompanyAdmin
    ? []
    : ((await supabase
        .from('companies')
        .select('id, nombre_comercial')
        .eq('business_space_id', session.spaceId)
        .eq('active', true)
        .order('nombre_comercial')).data ?? []).filter((company) =>
          !isScoped || session.accessCompanyIds.includes(company.id),
        )

  const companyId = isCompanyAdmin
    ? session.companyId
    : isScoped
      ? resolveScopedCompanyId(session, empresa)
      : companies.find((company) => company.id === empresa)?.id ?? companies[0]?.id ?? null
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

  const personas = dinerPeopleFilter(personasParam)
  const report = await loadDiners(supabase, companyId, date, personas)
  const extras = await loadExtras(supabase, session.spaceId, date, companyId)
  const extraTotal = extras.reduce((sum, row) => sum + row.quantity, 0)
  const printQuery = new URLSearchParams({ fecha: date, empresa: companyId, personas })
  const printHref = `/comensales/imprimir?${printQuery.toString()}`

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
      <FilterForm className="form-row">
        <input type="hidden" name="fecha" value={date} />
        {showCompanyFilter && (
          <label className="field">
            Empresa
            <select name="empresa" defaultValue={companyId}>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.nombre_comercial}</option>)}
            </select>
          </label>
        )}
        {!showCompanyFilter && !isCompanyAdmin && <input type="hidden" name="empresa" value={companyId} />}
        <label className="field">
          Personas
          <select name="personas" defaultValue={personas}>
            <option value="pidieron">Las que pidieron acá</option>
            <option value="todas">Todas las vigentes</option>
          </select>
        </label>
      </FilterForm>
      {error && <p className="error-banner">{error}</p>}
      <DinerCalendar date={date} empresa={isCompanyAdmin || (isScoped && !showCompanyFilter) ? undefined : companyId} personas={personas} />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Personas</h2>
            <p className="muted">{report.diners.length === 1 ? '1 persona' : `${report.diners.length} personas`}</p>
          </div>
        </div>
        {report.diners.length === 0 ? (
          <EmptyState
            title={personas === 'pidieron' ? 'Nadie pidió para esta empresa en esa fecha.' : 'No hay personas activas'}
            description={personas === 'pidieron'
              ? 'Quienes pidieron en otra locación no entran. Cambiá a todas las vigentes para verlas.'
              : 'Las personas activas de la empresa en esa fecha aparecen acá, incluido el encargado.'}
          />
        ) : (
          <DinerTable
            categories={report.categories}
            diners={report.diners}
            groups={report.groups}
            searchable
            cancelBack={isCompanyAdmin || isScoped ? undefined : `/comensales?${printQuery.toString()}`}
          />
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Pedido grupal</h2>
            <p className="muted">
              {extraTotal === 0
                ? 'Sin cantidades extra. Si la empresa manda el pedido por WhatsApp, se carga en Pedidos por empresa.'
                : extraTotal === 1 ? '1 unidad extra del día.' : `${extraTotal} unidades extra del día.`}
            </p>
          </div>
          {!isCompanyAdmin && !isScoped && (
            <Link className="outline-button" href={`/pedidos-empresa?fecha=${date}&empresa=${companyId}`}>Cargar pedido</Link>
          )}
          {isScoped && hasAccessView(session, 'pedidos_empresa') && (
            <Link className="outline-button" href={`/pedidos-empresa?fecha=${date}&empresa=${companyId}`}>Ver pedido</Link>
          )}
        </div>
        {extras.length === 0 ? (
          <p className="muted">No hay pedido grupal cargado para esta fecha.</p>
        ) : (
          <div className="report-bars">
            {extras
              .sort((a, b) => a.category_sort_order - b.category_sort_order || a.option_name.localeCompare(b.option_name, 'es'))
              .map((row) => (
                <div className="report-row" key={`${row.category_name}-${row.option_name}`}>
                  <span>{row.category_name} · {row.option_name}</span>
                  <strong>{row.quantity}</strong>
                </div>
              ))}
          </div>
        )}
      </section>
    </>
  )
}

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}
