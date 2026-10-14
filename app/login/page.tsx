import { Sparkles, UtensilsCrossed } from 'lucide-react'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-card">
        <div className="brand login-brand">
          <div className="brand-mark"><Sparkles size={17} /></div>
          <div><strong>Mora</strong><span>Gastronomía</span></div>
        </div>
        <p className="eyebrow">ESPACIO BALCARCE</p>
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
