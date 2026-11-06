import { EmptyState } from '@/components/empty-state'
import { FormDialog } from '@/components/form-dialog'
import { PageHeader } from '@/components/page-header'
import { AccessPersonForm, ResetScopedPasswordForm } from '@/components/access-person-form'
import { AccessRoleForm } from '@/components/access-role-form'
import { deactivateAccessRole, endScopedMembership } from '@/lib/actions/access'
import { ACCESS_VIEW_LABEL, ROLE_LABEL, formatDay, type AccessView, type AppRole } from '@/lib/format'
import { assertRole, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function EquipoPage() {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN'])
  const orgId = session.primary.organization_id
  const supabase = await createClient()

  const [
    { data: roles },
    { data: roleViews },
    { data: roleCompanies },
    { data: companies },
    { data: spaces },
    { data: staff },
  ] = await Promise.all([
    supabase
      .from('access_roles')
      .select('id, name, active, created_at')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),
    supabase.from('access_role_views').select('access_role_id, view_key'),
    supabase.from('access_role_companies').select('access_role_id, company_id'),
    supabase
      .from('companies')
      .select('id, nombre_comercial, business_space_id, active')
      .eq('active', true)
      .order('nombre_comercial'),
    supabase.from('business_spaces').select('id, name').eq('active', true),
    supabase
      .from('memberships')
      .select('id, role, status, started_at, ended_at, access_role_id, business_space_id, company_id, user_id, profiles!memberships_user_id_fkey(id, nombre, apellido, dni, email)')
      .eq('organization_id', orgId)
      .in('role', ['ORG_ADMIN', 'SPACE_ADMIN', 'KITCHEN', 'SCOPED'])
      .order('started_at', { ascending: false }),
  ])

  const spaceName = new Map((spaces ?? []).map((space) => [space.id, space.name]))
  const companyName = new Map((companies ?? []).map((company) => [company.id, company.nombre_comercial]))
  const companyOptions = (companies ?? []).map((company) => ({
    id: company.id,
    nombre_comercial: company.nombre_comercial,
    business_space_id: company.business_space_id,
    space_name: spaceName.get(company.business_space_id) ?? 'Espacio',
  }))

  const viewsByRole = new Map<string, AccessView[]>()
  for (const row of roleViews ?? []) {
    const list = viewsByRole.get(row.access_role_id) ?? []
    list.push(row.view_key as AccessView)
    viewsByRole.set(row.access_role_id, list)
  }
  const companiesByRole = new Map<string, string[]>()
  for (const row of roleCompanies ?? []) {
    const list = companiesByRole.get(row.access_role_id) ?? []
    list.push(row.company_id)
    companiesByRole.set(row.access_role_id, list)
  }

  const peopleCount = new Map<string, number>()
  for (const member of staff ?? []) {
    if (member.role === 'SCOPED' && member.status === 'ACTIVE' && member.access_role_id) {
      peopleCount.set(member.access_role_id, (peopleCount.get(member.access_role_id) ?? 0) + 1)
    }
  }

  const roleCards = (roles ?? []).map((role) => {
    const views = viewsByRole.get(role.id) ?? []
    const companyIds = companiesByRole.get(role.id) ?? []
    return {
      ...role,
      views,
      companyIds,
      companyLabels: companyIds.map((id) => companyName.get(id) ?? 'Empresa').join(', '),
      viewLabels: views.map((view) => ACCESS_VIEW_LABEL[view]).join(', '),
      people: peopleCount.get(role.id) ?? 0,
    }
  })

  const roleOptions = roleCards.map((role) => ({ id: role.id, name: role.name }))
  const roleName = new Map(roleCards.map((role) => [role.id, role.name]))

  const people = (staff ?? []).map((member) => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] ?? null : member.profiles
    return {
      membershipId: member.id,
      userId: profile?.id ?? member.user_id,
      nombre: profile?.nombre ?? '',
      apellido: profile?.apellido ?? '',
      dni: profile?.dni ?? '',
      email: profile?.email ?? '',
      role: member.role as AppRole,
      roleLabel: member.role === 'SCOPED' && member.access_role_id
        ? roleName.get(member.access_role_id) ?? 'Acceso limitado'
        : ROLE_LABEL[member.role as AppRole] ?? member.role,
      status: member.status,
      startedAt: member.started_at,
      endedAt: member.ended_at,
      spaceLabel: member.business_space_id ? spaceName.get(member.business_space_id) ?? '—' : 'Toda Mora',
      canEnd: member.role === 'SCOPED' && member.status === 'ACTIVE',
      canResetPassword: member.role === 'SCOPED' && member.status === 'ACTIVE',
    }
  })

  return (
    <>
      <PageHeader
        eyebrow="MORA"
        title="Equipo"
        description="Roles con pantallas y empresas, y las personas de Mora que los usan. Los encargados y empleados de cada cliente se gestionan en Empresas."
        action={
          <div className="header-actions">
            <FormDialog title="Nuevo rol" trigger="Crear rol" wide>
              <AccessRoleForm companies={companyOptions} />
            </FormDialog>
            <FormDialog title="Sumar persona" trigger="Sumar persona" wide>
              <AccessPersonForm roles={roleOptions} />
            </FormDialog>
          </div>
        }
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Roles</h2>
            <p className="muted">
              {roleCards.length === 1 ? '1 rol armado.' : `${roleCards.length} roles armados.`}
            </p>
          </div>
        </div>
        {roleCards.length === 0 ? (
          <EmptyState
            title="Todavía no hay roles"
            description="Creá uno, por ejemplo Cocina Arcor, con Reportes y Comensales solo para esa empresa."
          />
        ) : (
          <div className="report-bars">
            {roleCards.map((role) => (
              <div className="report-row" key={role.id} style={{ alignItems: 'flex-start' }}>
                <div>
                  <strong>{role.name}</strong>
                  <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                    {role.viewLabels || 'Sin pantallas'} · {role.companyLabels || 'Sin empresas'} ·{' '}
                    {role.people === 1 ? '1 persona' : `${role.people} personas`}
                  </p>
                </div>
                <div className="row-actions">
                  <FormDialog title={`Editar ${role.name}`} trigger="Editar" triggerClassName="outline-button" wide>
                    <AccessRoleForm
                      roleId={role.id}
                      name={role.name}
                      views={role.views}
                      companyIds={role.companyIds}
                      companies={companyOptions}
                    />
                  </FormDialog>
                  <form action={deactivateAccessRole}>
                    <input type="hidden" name="role_id" value={role.id} />
                    <button className="outline-button" type="submit">Desactivar</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Personas</h2>
            <p className="muted">Administradores, cocina del espacio y accesos limitados.</p>
          </div>
        </div>
        {people.length === 0 ? (
          <EmptyState title="Sin personas de Mora" description="Cuando sumes un acceso limitado, aparece acá." />
        ) : (
          <table className="report-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol</th>
                <th>Espacio</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.membershipId}>
                  <td>
                    <strong>{person.apellido}, {person.nombre}</strong>
                    <div className="muted">{person.email || person.dni}</div>
                  </td>
                  <td>{person.roleLabel}</td>
                  <td>{person.spaceLabel}</td>
                  <td>
                    {person.status === 'ACTIVE'
                      ? `Vigente desde ${formatDay(person.startedAt)}`
                      : `Cerrado${person.endedAt ? ` el ${formatDay(person.endedAt)}` : ''}`}
                  </td>
                  <td>
                    <div className="row-actions">
                      {person.canResetPassword ? (
                        <FormDialog title="Nueva contraseña" trigger="Clave" triggerClassName="outline-button">
                          <ResetScopedPasswordForm userId={person.userId} />
                        </FormDialog>
                      ) : null}
                      {person.canEnd ? (
                        <form action={endScopedMembership}>
                          <input type="hidden" name="membership_id" value={person.membershipId} />
                          <button className="outline-button" type="submit">Cerrar acceso</button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
