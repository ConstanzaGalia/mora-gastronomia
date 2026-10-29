import { NextRequest, NextResponse } from 'next/server'
import { searchWorkspace } from '@/lib/global-search'
import { getSessionContext } from '@/lib/session'

export async function GET(request: NextRequest) {
  const session = await getSessionContext()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.primary.role !== 'ORG_ADMIN' && session.primary.role !== 'SPACE_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const q = String(request.nextUrl.searchParams.get('q') ?? '')
  const groups = await searchWorkspace(session, q)
  return NextResponse.json({ groups })
}
