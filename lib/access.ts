import type { AccessView } from '@/lib/format'
import type { SessionContext } from '@/lib/session'
import { homePath } from '@/lib/format'
import { redirect } from 'next/navigation'

export const ALL_ACCESS_VIEWS: AccessView[] = ['inicio', 'comensales', 'reportes', 'pedidos_empresa']

export function isScoped(session: SessionContext) {
  return session.primary.role === 'SCOPED'
}

export function hasAccessView(session: SessionContext, view: AccessView) {
  if (session.primary.role === 'ORG_ADMIN' || session.primary.role === 'SPACE_ADMIN') return true
  if (session.primary.role === 'KITCHEN') return view === 'inicio' || view === 'reportes'
  if (session.primary.role === 'COMPANY_ADMIN') {
    return view === 'inicio' || view === 'comensales' || view === 'reportes'
  }
  if (session.primary.role === 'SCOPED') return session.accessViews.includes(view)
  return false
}

export function assertAccessView(session: SessionContext, view: AccessView) {
  if (!hasAccessView(session, view)) redirect(homePath(session.primary.role, session.accessViews))
}

export function allowedCompanyIds(session: SessionContext): string[] | null {
  if (session.primary.role === 'SCOPED') return session.accessCompanyIds
  if (session.primary.role === 'COMPANY_ADMIN') return session.companyId ? [session.companyId] : []
  return null
}

export function resolveScopedCompanyId(
  session: SessionContext,
  requested: string | null | undefined,
): string | null {
  const allowed = allowedCompanyIds(session)
  if (allowed === null) return requested || null
  if (!allowed.length) return null
  if (requested && allowed.includes(requested)) return requested
  return allowed[0] ?? null
}

export function canPickCompany(session: SessionContext) {
  if (session.primary.role === 'COMPANY_ADMIN') return false
  if (session.primary.role === 'SCOPED') return session.accessCompanyIds.length > 1
  return true
}
