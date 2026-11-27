export function formatRemitoNumber(pointOfSale: string, folio: number) {
  return `${pointOfSale}-${String(folio).padStart(8, '0')}`
}

export type RemitoItem = {
  category_name: string
  option_name: string
  quantity: number
  sort_order: number
  meal_shift: 'MORNING' | 'AFTERNOON' | null
}

export function remitoBandejaTotal(items: RemitoItem[]) {
  return items.reduce((sum, item) => {
    const folded = item.category_name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    if (folded === 'bandeja' || folded === 'bandejas') return sum + item.quantity
    return sum
  }, 0)
}

export function groupItemsByShift(items: RemitoItem[]) {
  const hasShifts = items.some((item) => item.meal_shift !== null)
  if (!hasShifts) return null

  const morning = items.filter((item) => item.meal_shift === 'MORNING')
  const afternoon = items.filter((item) => item.meal_shift === 'AFTERNOON')
  const extras = items.filter((item) => item.meal_shift === null)

  return { morning, afternoon, extras }
}
