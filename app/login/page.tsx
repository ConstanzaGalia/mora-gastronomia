import Image from 'next/image'
import { UtensilsCrossed } from 'lucide-react'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-card">
        <div className="brand login-brand">
          <Image src="/brand/mora-logo.png" alt="Mora Gastronomía" width={48} height={48} className="brand-logo" priority />
          <div><strong>Mora</strong><span>Gastronomía</span></div>
        </div>
        <p className="eyebrow">MORA GASTRONOMÍA</p>
        <h1>Ingresá a tu cuenta</h1>
        <p className="muted">Administradores entran con email. Empleados, con su DNI.</p>
        <LoginForm />
      </div>
      <div className="login-art">
        <div className="art-circle" />
        <div className="art-copy">
          <UtensilsCrossed size={23} />
          <p>Alimentar bien también es<br /><strong>hacer las cosas mejor.</strong></p>
        </div>
      </div>
    </main>
  )
}
