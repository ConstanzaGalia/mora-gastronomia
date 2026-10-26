export const SPACE_COOKIE = 'mora-space'
export const EVENTOS_SLUG = 'eventos'

export type SpaceOption = { id: string; name: string; slug: string }

export function isEventosSlug(slug: string) {
  return slug === EVENTOS_SLUG
}
