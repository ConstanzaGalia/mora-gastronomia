import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  badge,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  badge?: ReactNode
}) {
  return (
    <div className="welcome-row">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <div className="title-row">
          <h1>{title}</h1>
          {badge}
        </div>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
