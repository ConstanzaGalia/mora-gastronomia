export type CompanySector = { id: string; name: string; sort_order: number }

export function sectorKey(name: string) {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function matchSector(name: string, sectors: CompanySector[]) {
  const key = sectorKey(name)
  if (!key) return null
  return sectors.find((sector) => sectorKey(sector.name) === key) ?? null
}
