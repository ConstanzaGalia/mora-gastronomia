import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { PeopleForm } from '@/components/people-form'
import { PersonActions } from '@/components/person-actions'
import { StatusBadge } from '@/components/status-badge'
import { ROLE_LABEL, formatDay } from '@/lib/format'
import { assertRole, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function EmpleadosPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const session = await requireSession()
  assertRole(session, ['COMPANY_ADMIN'])
  if (!session.companyId) return <EmptyState title="Sin empresa" description="Tu acceso no está asociado a una empresa." />

  const supabase = await createClient()
  const { data: company } = await supabase.from('companies').select('nombre_comercial').eq('id', session.companyId).maybeSingle()
  const { data: members } = await supabase
    .from('memberships')
    .select('id, role, status, started_at, ended_at, profiles!memberships_user_id_fkey(id, nombre, apellido, dni)')
    .eq('company_id', session.companyId)
    .order('started_at', { ascending: false })

  return (
    <>
      <PageHeader eyebrow="TU EMPRESA" title="Empleados" description={company?.nombre_comercial ?? 'Personas de tu empresa.'} />
      {error && <p className="error-banner">{error}</p>}
      <section className="panel">
        <h2>Sumar empleado</h2>
        <p className="muted">Si el DNI ya existe, se reutiliza la cuenta. Las elecciones cerradas quedan en la empresa anterior.</p>
        <PeopleForm companyId={session.companyId} canAssignAdmin={false} />
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>PERSONA</th><th>DNI</th><th>ROL</th><th>DESDE</th><th>HASTA</th><th>ESTADO</th><th /></tr></thead>
            <tbody>
              {(members ?? []).map((member) => {
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
                    {profile && session.companyId && (
                      <PersonActions
                        membershipId={member.id}
                        companyId={session.companyId}
                        profileId={profile.id}
                        nombre={profile.nombre}
                        apellido={profile.apellido}
                        canEnd={member.status === 'ACTIVE' && member.role === 'EMPLOYEE'}
                        canDelete={member.role === 'EMPLOYEE'}
                        next="/empleados"
                      />
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
