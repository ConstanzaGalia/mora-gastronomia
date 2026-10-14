import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/landing-page'
import { getSessionContext } from '@/lib/session'
import { homePath } from '@/lib/format'

export default async function Home() {
  const session = await getSessionContext()
  if (session) redirect(homePath(session.primary.role))
  return <LandingPage />
}
