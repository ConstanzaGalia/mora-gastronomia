import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CategoryForm } from '@/components/category-form'
import { CompanySectors } from '@/components/company-sectors'
import { DinerCalendar } from '@/components/diner-calendar'
import { EmployeeImportForm } from '@/components/employee-import'
import { CompanyForm } from '@/components/company-form'
import { DeleteButton } from '@/components/delete-button'
import { EmptyState } from '@/components/empty-state'
import { FormDialog } from '@/components/form-dialog'
import { PageHeader } from '@/components/page-header'
import { PeopleForm } from '@/components/people-form'
import { PeopleTable } from '@/components/people-table'
import { StatusBadge } from '@/components/status-badge'
import { deleteCompany } from '@/lib/actions/companies'
import { businessToday, formatDay, selectionCloseInput } from '@/lib/format'
import { extraNote, loadExtras, mergeKitchen } from '@/lib/kitchen'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function EmpresaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; fecha?: string }>
}) {
  const { id } = await params
  const { error, fecha } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertViandasSpace(session)
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, nombre_comercial, razon_social, cuit, active, business_space_id, selection_close_time')
    .eq('id', id)
    .maybeSingle()
  if (!company || company.business_space_id !== session.spaceId) notFound()

  const [{ data: categories }, { data: enabled }, { data: members }, { data: sectorRows }] = await Promise.all([
    supabase.from('gastronomic_categories').select('id, name, active').eq('business_space_id', session.spaceId).order('sort_order'),
    supabase.from('company_gastronomic_categories').select('category_id, active').eq('company_id', id),
    supabase.from('memberships').select('id, role, status, started_at, ended_at, sector_id, profiles!memberships_user_id_fkey(id, nombre, apellido, dni)').eq('company_id', id),
    supabase.from('company_sectors').select('id, name, sort_order').eq('company_id', id).order('sort_order'),
  ])
  const sectors = sectorRows ?? []
  const sectorName = new Map(sectors.map((sector) => [sector.id, sector.name]))

  const enabledIds = new Set((enabled ?? []).filter((row) => row.active).map((row) => row.category_id))
  const people = (members ?? []).map((member) => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] ?? null : member.profiles
    return {
      membershipId: member.id,
      profileId: profile?.id ?? null,
      nombre: profile?.nombre ?? '',
      apellido: profile?.apellido ?? '',
      dni: profile?.dni ?? '',
      sectorLabel: member.role === 'EMPLOYEE' ? (member.sector_id ? sectorName.get(member.sector_id) ?? '—' : 'Sin sector') : '—',
      role: member.role,
      startedAt: member.started_at,
      endedAt: member.ended_at,
      status: member.status,
      sectorId: member.sector_id,
      showSector: member.role === 'EMPLOYEE' && member.status === 'ACTIVE',
      canEnd: member.status === 'ACTIVE',
    }
  })
  const activePeople = people.filter((person) => person.status === 'ACTIVE')
  const employees = activePeople.filter((person) => person.role === 'EMPLOYEE')
  const managers = activePeople
    .filter((person) => person.role === 'COMPANY_ADMIN')
    .map((person) => `${person.nombre} ${person.apellido}`.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  const summary = [company.razon_social, company.cuit].filter(Boolean).join(' · ')
  const date = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : businessToday()
  const [{ data: optionRows }, extras] = await Promise.all([
    supabase
      .from('v_daily_company_option_totals')
      .select('category_name, option_name, total, category_sort_order')
      .eq('company_id', id)
      .eq('service_date', date),
    loadExtras(supabase, session.spaceId, date, id),
  ])
  const chosen = mergeKitchen(optionRows ?? [], extras)
  const chosenTotal = chosen.reduce((sum, row) => sum + Number(row.total ?? 0), 0)

  return (
    <>
      <PageHeader
        eyebrow="EMPRESA"
        title={company.nombre_comercial}
        description={summary || 'Datos, categorías y personas de la empresa.'}
        action={
          <div className="company-facts">
            <div className="company-fact">
              <span>Empleados</span>
              <strong>{employees.length}</strong>
            </div>
            <div className="company-fact">
              <span>Encargado</span>
              <strong>{managers.length ? managers.join(', ') : 'Sin encargado'}</strong>
            </div>
            <StatusBadge tone={company.active ? 'success' : 'muted'}>{company.active ? 'Activa' : 'Inactiva'}</StatusBadge>
          </div>
        }
      />
      {error && <p className="error-banner">{error}</p>}
      <div className="company-page">
      <div className="company-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Datos</h2>
            <p className="muted">Nombre comercial, razón social, CUIT y hora de cierre.</p>
          </div>
          <div className="heading-actions">
            <FormDialog title="Editar empresa" trigger="Editar" triggerClassName="outline-button">
              <CompanyForm company={company} />
            </FormDialog>
            <DeleteButton action={deleteCompany} name={company.nombre_comercial} label="Eliminar empresa" fields={{ id: company.id, from: `/empresas/${company.id}` }} />
          </div>
        </div>
        <dl className="company-summary">
          <div><dt>Nombre comercial</dt><dd>{company.nombre_comercial}</dd></div>
          <div><dt>Razón social</dt><dd>{company.razon_social || '—'}</dd></div>
          <div><dt>CUIT</dt><dd>{company.cuit || '—'}</dd></div>
          <div><dt>Estado</dt><dd>{company.active ? 'Activa' : 'Inactiva'}</dd></div>
          <div><dt>Horario de cierre</dt><dd>{selectionCloseInput(company.selection_close_time)}</dd></div>
        </dl>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Categorías</h2>
            <p className="muted">Del catálogo de {session.spaceName}. No se copian las opciones.</p>
          </div>
          <FormDialog title="Categorías" trigger="Editar categorías" triggerClassName="outline-button">
            <p className="muted">Las empresas solo eligen qué categorías tienen. Las opciones siguen siendo del catálogo.</p>
            <CategoryForm companyId={company.id} categories={categories ?? []} enabledIds={[...enabledIds]} />
          </FormDialog>
        </div>
        {(categories ?? []).filter((category) => enabledIds.has(category.id)).length === 0 ? (
          <p className="muted ledger-empty">Todavía no hay categorías habilitadas.</p>
        ) : (
          <ul className="category-chips">
            {(categories ?? []).filter((category) => enabledIds.has(category.id)).map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ul>
        )}
      </section>
      </div>
      <CompanySectors companyId={company.id} sectors={sectors} />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Calendario</h2>
            <p className="muted">
              {chosenTotal === 0
                ? `Opciones que eligió el ${formatDay(date)}.`
                : chosenTotal === 1
                  ? `1 unidad el ${formatDay(date)}.`
                  : `${chosenTotal} unidades el ${formatDay(date)}.`}
            </p>
          </div>
          <div className="heading-actions">
            <Link className="outline-button" href={`/comensales?fecha=${date}&empresa=${company.id}`}>Comensales</Link>
            <Link className="outline-button" href={`/reportes?fecha=${date}&empresa=${company.id}`}>Reportes</Link>
          </div>
        </div>
        <DinerCalendar date={date} path={`/empresas/${company.id}`} />
        {chosen.length === 0 ? (
          <EmptyState title={`Sin elecciones el ${formatDay(date)}`} description="Cuando el equipo elija o se cargue un pedido grupal, las opciones aparecen acá." />
        ) : (
          <div className="report-bars">
            {chosen.map((row) => (
              <div className="report-row" key={`${row.category_name}-${row.option_name}`}>
                <span>{row.category_name} · {row.option_name}{extraNote(row.extras)}</span>
                <strong>{row.total}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Personas</h2>
            <p className="muted">{activePeople.length === 1 ? '1 vigente.' : `${activePeople.length} vigentes.`}</p>
          </div>
          <div className="heading-actions">
            <FormDialog title="Importar empleados" trigger="Importar Excel" triggerClassName="outline-button" wide>
              <EmployeeImportForm companyId={company.id} />
            </FormDialog>
            <FormDialog title="Vincular persona" trigger="Vincular persona">
              <p className="muted">Buscá por DNI. Si ya existe, se reutiliza la cuenta.</p>
              <PeopleForm companyId={company.id} canAssignAdmin sectors={sectors} />
            </FormDialog>
          </div>
        </div>
        {people.length === 0 ? <EmptyState title="Todavía no hay personas" description="Buscá por DNI para vincular un empleado o un encargado." /> : (
          <PeopleTable people={people} companyId={company.id} next={`/empresas/${company.id}`} sectors={sectors} />
        )}
      </section>
      </div>
    </>
  )
}
