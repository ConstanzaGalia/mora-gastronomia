import { NextRequest, NextResponse } from 'next/server'
import { tucumanQuery } from '@/lib/geocode'
import { getSessionContext } from '@/lib/session'

const cache = new Map<string, { lat: number; lng: number } | null>()
let lastAt = 0

export async function GET(request: NextRequest) {
  const session = await getSessionContext()
  if (!session || session.primary.role !== 'ORG_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const q = String(request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 6 || q.length > 200) {
    return NextResponse.json({ lat: null, lng: null })
  }

  const query = tucumanQuery(q)
  if (cache.has(query)) {
    const hit = cache.get(query)
    return NextResponse.json(hit ?? { lat: null, lng: null })
  }

  const wait = 1100 - (Date.now() - lastAt)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastAt = Date.now()

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'ar')
  url.searchParams.set('q', query)
  url.searchParams.set('viewbox', '-65.35,-26.70,-65.10,-26.90')
  url.searchParams.set('bounded', '0')

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'MoraGastronomia/1.0 (mercadito pedidos)',
      'Accept-Language': 'es-AR',
    },
  })
  if (!response.ok) {
    return NextResponse.json({ lat: null, lng: null }, { status: 502 })
  }

  const rows = (await response.json()) as { lat: string; lon: string }[]
  const first = rows[0]
  const result = first ? { lat: Number(first.lat), lng: Number(first.lon) } : null
  cache.set(query, result)
  return NextResponse.json(result ?? { lat: null, lng: null })
}
