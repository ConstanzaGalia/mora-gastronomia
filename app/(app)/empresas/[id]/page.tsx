import { notFound } from 'next/navigation'
import { CategoryForm } from '@/components/category-form'
import { EmployeeImportForm } from '@/components/employee-import'
import { CompanyForm } from '@/components/company-form'
import { DeleteButton } from '@/components/delete-button'
import { EmptyState } from '@/components/empty-state'
import { FormDialog } from '@/components/form-dialog'
import { PageHeader } from '@/components/page-header'
import { PeopleForm } from '@/components/people-form'
import { PersonActions } from '@/components/person-actions'
import { StatusBadge } from '@/components/status-badge'
import { deleteCompany } from '@/lib/actions/companies'
import { ROLE_LABEL, formatDay } from '@/lib/format'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function EmpresaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertViandasSpace(session)
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, nombre_comercial, razon_social, cuit, active, business_space_id')
    .eq('id', id)
    .maybeSingle()
  if (!company || company.business_space_id !== session.spaceId) notFound()

  const [{ data: categories }, { data: enabled }, { data: members }] = await Promise.all([
    supabase.from('gastronomic_categories').select('id, name, active').eq('business_space_id', session.spaceId).order('sort_order'),
    supabase.from('company_gastronomic_categories').select('category_id, active').eq('company_id', id),
    supabase.from('memberships').select('id, role, status, started_at, ended_at, profiles!memberships_user_id_fkey(id, nombre, apellido, dni)').eq('company_id', id).order('started_at', { ascending: false }),
  ])

  const enabledIds = new Set((enabled ?? []).filter((row) => row.active).map((row) => row.category_id))
  const people = members ?? []
  const activePeople = people.filter((member) => member.status === 'ACTIVE')
  const employees = activePeople.filter((member) => member.role === 'EMPLOYEE')
  const managers = activePeople
    .filter((member) => member.role === 'COMPANY_ADMIN')
    .map((member) => member.profiles ? `${member.profiles.nombre} ${member.profiles.apellido}`.trim() : '')
    .filter(Boolean)
  const summary = [company.razon_social, company.cuit].filter(Boolean).join(' · ')

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
            <p className="muted">Nombre comercial, razón social y CUIT.</p>
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
              <PeopleForm companyId={company.id} canAssignAdmin />
            </FormDialog>
          </div>
        </div>
        {people.length === 0 ? <EmptyState title="Todavía no hay personas" description="Buscá por DNI para vincular un empleado o un encargado." /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>PERSONA</th><th>DNI</th><th>ROL</th><th>DESDE</th><th>HASTA</th><th>ESTADO</th><th /></tr></thead>
            <tbody>
              {people.map((member) => {
                const profile = member.profiles
                return (
                  <tr key={member.id}>
                    <td>{profile ? `${profile.apellido}, ${profile.nombre}` : '—'}</td>
                    <td>{profile?.dni ?? '—'}</td>
                    <td>{ROLE_LABEL[member.role]}</td>
                    <td>{formatDay(member.started_at)}</td>
                    <td>{member.ended_at ? formatDay(member.ended_at) : '—'}</td>
                    <td><StatusBadge tone={member.status === 'ACTIVE' ? 'success' : 'muted'}>{member.status === 'ACTIVE' ? 'Vigente' : 'Cerrada'}</StatusBadge></td>
                    <td>
                      {profile && (
                        <PersonActions
                          membershipId={member.id}
                          companyId={company.id}
                          profileId={profile.id}
                          nombre={profile.nombre}
                          apellido={profile.apellido}
                          canEnd={member.status === 'ACTIVE'}
                          next={`/empresas/${company.id}`}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}
      </section>
      </div>
    </>
  )
}
