import Image from 'next/image'
import Link from 'next/link'
import { Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google'
import { LandingMenu } from '@/components/landing-menu'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-playfair',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-jakarta',
})

const contact = {
  phone: '381-2203104',
  phoneHref: 'tel:3812203104',
  whatsapp: 'https://wa.me/5493813201368',
  whatsappDisplay: '+54 9 381 320-1368',
  email: 'viandasmora@gmail.com',
  emailHref: 'mailto:viandasmora@gmail.com',
  instagram: 'https://instagram.com/gastronomia.mora',
  instagramHandle: '@gastronomia.mora',
  year: 2026,
}

const navLinks = [
  { href: '#sobre-nosotros', label: 'Nosotros' },
  { href: '#propuesta-de-valor', label: 'Propuesta' },
  { href: '#menus', label: 'Menús' },
  { href: '#clientes', label: 'Clientes' },
  { href: '#condiciones', label: 'Condiciones' },
  { href: '#contacto', label: 'Contacto' },
]

export function LandingPage() {
  return (
    <div className={`${playfair.variable} ${jakarta.variable} landing bg-background font-body-md text-on-surface antialiased`}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
      />
    <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between gap-4">
        <a href="#" className="flex items-center gap-3 shrink-0">
          <Image src="/brand/mora-logo.png" alt="Mora Gastronomía" width={48} height={48} className="h-11 w-11 object-contain" priority />
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm tracking-tight text-primary leading-none">
              Morá
            </span>
            <span className="font-label-sm text-label-sm tracking-wider uppercase text-on-surface-variant">
              Gastronomía Corporativa
            </span>
          </div>
        </a>
        <nav className="hidden xl:flex items-center gap-5 whitespace-nowrap">
          {navLinks.map((link) => (
            <a key={link.href} className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors py-2" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <Link href="/mercadito" className="inline-flex items-center gap-1.5 whitespace-nowrap text-on-surface-variant hover:text-on-surface font-label-lg text-label-lg h-10 px-2 rounded-lg transition-colors">
            Mercadito
          </Link>
          <a className="inline-flex items-center gap-1.5 whitespace-nowrap bg-primary text-on-primary hover:bg-inverse-surface font-label-lg text-label-lg h-10 px-3.5 rounded-lg transition-colors" href={contact.whatsapp} rel="noopener noreferrer" target="_blank">
            <span className="material-symbols-outlined text-[18px] text-secondary-fixed">
              chat
            </span>
            <span className="hidden sm:inline">
              Cotización
            </span>
          </a>
          <Link href="/login" className="inline-flex items-center gap-1.5 whitespace-nowrap text-on-surface-variant hover:text-on-surface font-label-lg text-label-lg h-10 px-2 rounded-lg transition-colors" aria-label="Iniciar sesión">
            <span className="material-symbols-outlined text-[18px]">person</span>
            <span className="hidden sm:inline">Ingresar</span>
          </Link>
          <LandingMenu links={navLinks} />
        </div>
      </div>
    </header>
    <main className="w-full pt-20 bg-background">
      <div className="flex flex-col w-full">
        <section className="relative w-full overflow-hidden bg-surface py-12 lg:py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              <div className="lg:col-span-7 flex flex-col gap-6 z-10">
                <div className="inline-flex items-center gap-2 self-start bg-secondary-container px-3.5 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-secondary">
                  </span>
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-secondary-fixed">
                    Gastronomía B2B • San Miguel de Tucumán
                  </span>
                </div>
                <h1 className="font-display-hero text-headline-lg lg:text-display-hero text-primary tracking-tight leading-tight">
                  Soluciones gastronómicas reales para tu empresa.
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
                  Viandas ejecutivas e industriales en San Miguel de Tucumán. Cuidamos la nutrición y el bienestar de tu equipo para potenciar la productividad diaria con puntualidad logística milimétrica.
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                  <a className="inline-flex items-center justify-center gap-2 bg-on-tertiary-container hover:bg-tertiary-container text-on-tertiary font-label-lg text-label-lg px-7 py-3.5 rounded-lg shadow-sm transition-all duration-200" href="#contacto">
                    <span className="material-symbols-outlined text-[20px]">
                      assignment
                    </span>
                    <span className="">
                      Solicitar cotización corporativa
                    </span>
                  </a>
                  <a className="inline-flex items-center justify-center gap-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-lg text-label-lg px-6 py-3.5 rounded-lg transition-all" href="#menus">
                    <span className="material-symbols-outlined text-[20px]">
                      restaurant_menu
                    </span>
                    <span className="">
                      Ver propuesta de menús
                    </span>
                  </a>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6">
                  <div className="bg-surface-container-low p-3.5 rounded-xl flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary text-[26px] shrink-0">
                      verified
                    </span>
                    <div className="flex flex-col">
                      <span className="font-title-md text-title-md text-on-surface leading-tight">
                        +8 Empresas
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        Líderes confían en nosotros
                      </span>
                    </div>
                  </div>
                  <div className="bg-surface-container-low p-3.5 rounded-xl flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-tertiary-container text-[26px] shrink-0">
                      dashboard_customize
                    </span>
                    <div className="flex flex-col">
                      <span className="font-title-md text-title-md text-on-surface leading-tight">
                        5 Opciones
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        Rotativas al día
                      </span>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1 bg-surface-container-low p-3.5 rounded-xl flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary text-[26px] shrink-0">
                      eco
                    </span>
                    <div className="flex flex-col">
                      <span className="font-title-md text-title-md text-on-surface leading-tight">
                        Sin T.A.C.C. & Veggie
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        Opciones certificadas
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-5 relative flex justify-center">
                <div className="relative w-full max-w-md lg:max-w-none">
                  <div className="absolute inset-0 bg-secondary rounded-2xl transform translate-x-3 translate-y-3 lg:translate-x-4 lg:translate-y-4">
                  </div>
                  <div className="relative bg-surface-container-lowest p-3 rounded-2xl shadow-xl overflow-hidden">
                    <div className="relative w-full h-96 lg:h-[460px]">
                      <Image src="/landing/hero.jpg" alt="Close up overhead shot of wholesome handcrafted artisanal corporate meal containers by Morá Gastronomía. Perfectly cooked croquettes and fresh crisp salad with shredded carrots, purple cabbage, and crisp greens in safe microwave-safe clear containers, shot on warm neutral linen in San Miguel de Tucumán with warm natural culinary lighting." fill className="object-cover rounded-xl" sizes="(min-width: 1024px) 42vw, 100vw" />
                    </div>
                    <div className="absolute bottom-6 left-6 right-6 bg-surface-container-lowest/95 backdrop-blur-md p-4 rounded-xl shadow-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
                          <span className="material-symbols-outlined text-secondary text-[22px]">
                            timer
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-title-md text-title-md text-on-surface leading-none">
                            Puntualidad en Planta
                          </span>
                          <span className="font-body-sm text-body-sm text-on-surface-variant">
                            Entregas fijadas con exactitud
                          </span>
                        </div>
                      </div>
                      <span className="font-label-sm text-label-sm text-on-secondary-fixed bg-secondary-fixed px-2.5 py-1 rounded-full uppercase">
                        100% Auditado
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full bg-primary-container text-on-primary py-16 lg:py-24" id="sobre-nosotros">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              <div className="lg:col-span-5 relative order-2 lg:order-1">
                <div className="relative">
                  <div className="absolute -top-6 -bottom-6 -left-4 w-12 bg-secondary hidden sm:block rounded-l-lg">
                  </div>
                  <div className="relative bg-surface-container-lowest p-3 rounded-xl shadow-2xl">
                    <div className="relative w-full h-80 sm:h-96 lg:h-[420px]">
                      <Image src="/landing/about.jpg" alt="Editorial overhead capture of a woman's manicured hands holding an open fresh corporate lunch container with golden potato medallions and colorful raw vegetable salad including shredded cabbage and carrots, captured with warm Mediterranean kitchen lighting and neutral tones." fill className="object-cover rounded-lg" sizes="(min-width: 1024px) 42vw, 100vw" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-7 flex flex-col gap-6 order-1 lg:order-2">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-0.5 bg-on-tertiary-container">
                  </span>
                  <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-primary-container">
                    Nuestra Identidad
                  </span>
                </div>
                <h2 className="font-headline-lg text-headline-lg lg:text-display-hero text-on-primary font-bold tracking-tight">
                  Sobre nosotros.
                </h2>
                <div className="flex flex-col gap-5 text-inverse-on-surface">
                  <p className="font-body-lg text-body-lg leading-relaxed">
                    En
                    <strong className="text-on-primary">
                      Morá Gastronomía
                    </strong>
                    nos especializamos en el diseño, elaboración y provisión integral de viandas ejecutivas e industriales. Comprendemos que la alimentación en el entorno laboral representa un factor estratégico clave para el bienestar, la productividad y el clima organizacional de los equipos de trabajo.
                  </p>
                  <p className="font-body-lg text-body-lg leading-relaxed">
                    Nos distinguimos por ofrecer una gestión personalizada, alineada rigurosamente con los estándares de inocuidad, equilibrio nutricional y puntualidad logística que exigen las organizaciones de primera línea.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
                  <div className="bg-inverse-surface p-4 rounded-xl">
                    <span className="font-headline-sm text-headline-sm text-on-tertiary-container">
                      100%
                    </span>
                    <p className="font-body-sm text-body-sm text-on-primary-container">
                      Inocuidad y trazabilidad
                    </p>
                  </div>
                  <div className="bg-inverse-surface p-4 rounded-xl">
                    <span className="font-headline-sm text-headline-sm text-secondary-fixed">
                      45 días
                    </span>
                    <p className="font-body-sm text-body-sm text-on-primary-container">
                      Preaviso y transparencia
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1 bg-inverse-surface p-4 rounded-xl">
                    <span className="font-headline-sm text-headline-sm text-on-primary">
                      Diario
                    </span>
                    <p className="font-body-sm text-body-sm text-on-primary-container">
                      Despacho en planta
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full bg-surface-container-low py-16 lg:py-24" id="propuesta-de-valor">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col gap-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex flex-col gap-3 max-w-2xl">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                  Excelencia Operacional
                </span>
                <h2 className="font-headline-lg text-headline-lg text-primary">
                  Propuesta operativa y valor agregado
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Construimos un ecosistema culinario pensado específicamente para simplificar la logística de RRHH y dar máxima satisfacción nutricional a cada colaborador.
                </p>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-full font-label-sm text-label-sm text-on-surface">
                  <span className="material-symbols-outlined text-secondary text-[18px]">
                    verified_user
                  </span>
                  Protocolo Bromatológico Vigente
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-md">
                <div className="flex flex-col gap-5">
                  <div className="w-14 h-14 rounded-xl bg-secondary-container flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-[30px]">
                      nutrition
                    </span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-primary">
                    Planificación Nutricional
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                    Menú rotativo semanal con
                    <strong className="text-on-surface">
                      5 alternativas diarias
                    </strong>
                    (4 opciones variables y 1 fija). Diseñado por profesionales con carnes vacunas y de ave, pastas caseras, platos vegetarianos y opciones aptas para celíacos (Sin T.A.C.C.).
                  </p>
                </div>
                <div className="pt-6 mt-6 bg-surface-container-low/50 p-4 rounded-xl flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">
                    Variedad garantizada
                  </span>
                  <span className="material-symbols-outlined text-secondary text-[18px]">
                    check_circle
                  </span>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-md">
                <div className="flex flex-col gap-5">
                  <div className="w-14 h-14 rounded-xl bg-tertiary-fixed flex items-center justify-center text-on-tertiary-container">
                    <span className="material-symbols-outlined text-[30px]">
                      sanitizer
                    </span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-primary">
                    Normas de Inocuidad
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                    Envasado individual en
                    <strong className="text-on-surface">
                      bandejas descartables aptas para microondas y congelado
                    </strong>
                    , con film de seguridad termosellado para preservar la temperatura, frescura, sabor e higiene intactos durante el traslado.
                  </p>
                </div>
                <div className="pt-6 mt-6 bg-surface-container-low/50 p-4 rounded-xl flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase font-semibold">
                    Termosellado hermético
                  </span>
                  <span className="material-symbols-outlined text-on-tertiary-container text-[18px]">
                    check_circle
                  </span>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-md">
                <div className="flex flex-col gap-5">
                  <div className="w-14 h-14 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[30px]">
                      devices
                    </span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-primary">
                    Gestión Digital y Flexibilidad
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                    Acceso a
                    <strong className="text-on-surface">
                      plataforma web corporativa
                    </strong>
                    con credenciales individuales para la autogestión de elecciones por cada colaborador, complementado con canal directo centralizado de WhatsApp para casos particulares.
                  </p>
                </div>
                <div className="pt-6 mt-6 bg-surface-container-low/50 p-4 rounded-xl flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-primary uppercase font-semibold">
                    Cero carga administrativa
                  </span>
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    check_circle
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full bg-surface py-16 lg:py-24" id="menus">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col gap-12">
            <div className="text-center max-w-3xl mx-auto flex flex-col gap-3">
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-tertiary-container">
                Planes de Servicio Diario
              </span>
              <h2 className="font-headline-lg text-headline-lg text-primary">
                Estructura de menús corporativos
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Modalidades flexibles que se adaptan a la intensidad y jornada laboral de tu empresa. Todas nuestras viandas incluyen cubiertos descartables y aderezos individuales.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
              <div className="bg-surface-container-low p-8 rounded-2xl flex flex-col justify-between shadow-sm">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                      Servicio Esencial
                    </span>
                    <h3 className="font-headline-sm text-headline-sm text-primary">
                      Menú Opción I
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Ideal para servicio ágil, balanceado y turnos dinámicos en planta u oficina.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 py-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">
                        check
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Bandeja de Comida Elaborada (Caliente o Ensalada Completa)
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">
                        check
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Pan artesanal individual
                      </span>
                    </div>
                    <div className="flex items-start gap-3 text-on-surface-variant/60">
                      <span className="material-symbols-outlined text-[20px] shrink-0">
                        close
                      </span>
                      <span className="font-body-md text-body-md">
                        Fruta de estación
                      </span>
                    </div>
                    <div className="flex items-start gap-3 text-on-surface-variant/60">
                      <span className="material-symbols-outlined text-[20px] shrink-0">
                        close
                      </span>
                      <span className="font-body-md text-body-md">
                        Bebida individual
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-6">
                  <a className="w-full inline-flex items-center justify-center bg-surface-container-highest hover:bg-surface-container text-on-surface font-label-lg text-label-lg py-3 rounded-lg transition-colors" href="#contacto">
                    Consultar Opción I
                  </a>
                </div>
              </div>
              <div className="relative bg-primary text-on-primary p-8 rounded-2xl flex flex-col justify-between shadow-xl transform md:-translate-y-2">
                <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 bg-on-tertiary-container text-on-tertiary px-4 py-1 rounded-full font-label-sm text-label-sm tracking-wider uppercase font-bold shadow-md">
                  Más Elegido por Empresas
                </div>
                <div className="flex flex-col gap-6 pt-2">
                  <div className="flex flex-col gap-2">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed">
                      Equilibrio Óptimo Diario
                    </span>
                    <h3 className="font-headline-sm text-headline-sm text-on-primary">
                      Menú Opción II
                    </h3>
                    <p className="font-body-sm text-body-sm text-primary-fixed-dim">
                      El balance perfecto entre aporte calórico, frescura natural y valor para el equipo.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 py-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-secondary-fixed text-[20px] shrink-0">
                        check
                      </span>
                      <span className="font-body-md text-body-md text-on-primary">
                        Bandeja de Comida Elaborada (Rotación diaria)
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-secondary-fixed text-[20px] shrink-0">
                        check
                      </span>
                      <span className="font-body-md text-body-md text-on-primary">
                        Pan artesanal individual
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-secondary-fixed text-[20px] shrink-0">
                        check
                      </span>
                      <span className="font-body-md text-body-md text-on-primary">
                        Fruta fresca seleccionada de estación
                      </span>
                    </div>
                    <div className="flex items-start gap-3 text-on-primary-container">
                      <span className="material-symbols-outlined text-[20px] shrink-0">
                        close
                      </span>
                      <span className="font-body-md text-body-md">
                        Bebida / Agua saborizada
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-6">
                  <a className="w-full inline-flex items-center justify-center bg-on-tertiary-container hover:bg-tertiary-container text-on-tertiary font-label-lg text-label-lg py-3 rounded-lg shadow-md transition-all" href="#contacto">
                    Cotizar Plan Preferente
                  </a>
                </div>
              </div>
              <div className="bg-surface-container-low p-8 rounded-2xl flex flex-col justify-between shadow-sm">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                      Solución Integral VIP
                    </span>
                    <h3 className="font-headline-sm text-headline-sm text-primary">
                      Menú Opción III
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Experiencia corporativa 360° con hidratación y nutrición resuelta al 100%.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 py-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">
                        check
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Bandeja de Comida Elaborada Gourmet
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">
                        check
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Pan artesanal individual
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">
                        check
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Fruta fresca seleccionada de estación
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">
                        check
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Agua mineral o agua saborizada individual
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-6">
                  <a className="w-full inline-flex items-center justify-center bg-surface-container-highest hover:bg-surface-container text-on-surface font-label-lg text-label-lg py-3 rounded-lg transition-colors" href="#contacto">
                    Consultar Opción III
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full bg-primary-container text-on-primary py-16 lg:py-24" id="condiciones">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              <div className="lg:col-span-5 relative order-2 lg:order-1">
                <div className="relative">
                  <div className="absolute -top-8 -bottom-8 -left-5 w-14 bg-secondary hidden sm:block rounded-l-lg">
                  </div>
                  <div className="relative bg-surface-container-lowest p-3 rounded-xl shadow-2xl">
                    <div className="relative w-full h-80 sm:h-96 lg:h-[480px]">
                      <Image src="/landing/delivery.jpg" alt="Professional courteous Morá delivery courier wearing dark uniform and cap smiling as he hands a stack of clean white eco-friendly catering meal containers to an office receptionist in a modern bright corporate lobby in San Miguel de Tucumán." fill className="object-cover rounded-lg" sizes="(min-width: 1024px) 42vw, 100vw" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-7 flex flex-col gap-6 order-1 lg:order-2">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-0.5 bg-secondary-fixed">
                  </span>
                  <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-primary-container">
                    Términos Clave B2B
                  </span>
                </div>
                <h2 className="font-headline-lg text-headline-lg lg:text-headline-lg text-on-primary font-bold tracking-tight">
                  Condiciones de contratación y Marco operativo
                </h2>
                <div className="flex flex-col gap-6 pt-2">
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-inverse-surface/60">
                    <div className="w-10 h-10 rounded-lg bg-secondary text-on-secondary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">
                        local_shipping
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h4 className="font-title-md text-title-md text-on-primary font-bold">
                        Logística y Distribución
                      </h4>
                      <p className="font-body-md text-body-md text-inverse-on-surface">
                        Entrega diaria en horarios fijados por la empresa.
                        <strong>
                          Flete bonificado en operaciones desde 30 viandas diarias.
                        </strong>
                        Consultar tarifas para volúmenes menores.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-inverse-surface/60">
                    <div className="w-10 h-10 rounded-lg bg-on-tertiary-container text-on-tertiary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">
                        schedule
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h4 className="font-title-md text-title-md text-on-primary font-bold">
                        Flexibilidad Operativa
                      </h4>
                      <p className="font-body-md text-body-md text-inverse-on-surface">
                        Solicitudes y adiciones de menús en el día canalizables
                        <strong>
                          hasta las 9.00 hs
                        </strong>
                        . Cancelación de pedidos diarios con 48 hs. de antelación.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-inverse-surface/60">
                    <div className="w-10 h-10 rounded-lg bg-secondary text-on-secondary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">
                        receipt_long
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h4 className="font-title-md text-title-md text-on-primary font-bold">
                        Facturación y Pagos
                      </h4>
                      <p className="font-body-md text-body-md text-inverse-on-surface">
                        Facturación con periodicidad
                        <strong>
                          semanal o quincenal
                        </strong>
                        . Modalidades de pago aceptadas: Transferencia bancaria y/o efectivo contra factura electrónica.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-inverse-surface/60">
                    <div className="w-10 h-10 rounded-lg bg-on-surface-variant text-surface flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">
                        trending_up
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h4 className="font-title-md text-title-md text-on-primary font-bold">
                        Vigencia y Ajuste
                      </h4>
                      <p className="font-body-md text-body-md text-inverse-on-surface">
                        Los valores se ajustarán según índices de variación de costos, previa notificación consensuada.
                        <strong>
                          Cese de servicio con 45 días de preaviso.
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full bg-surface-container py-16 lg:py-24" id="clientes">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              <div className="lg:col-span-7 flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-0.5 bg-secondary">
                  </span>
                  <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
                    Confianza Comprobada
                  </span>
                </div>
                <h2 className="font-headline-lg text-headline-lg lg:text-display-hero text-primary font-bold tracking-tight">
                  Trayectoria Corporativa
                </h2>
                <p className="font-body-lg text-body-lg text-on-surface-variant">
                  Respaldan la calidad de nuestra gestión empresas de destacada trayectoria en Tucumán y la región NOA:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                  <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-secondary shrink-0 font-bold text-sm">
                      •
                    </div>
                    <span className="font-title-md text-title-md text-primary font-bold">
                      Citrícola San Miguel
                    </span>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-secondary shrink-0 font-bold text-sm">
                      •
                    </div>
                    <span className="font-title-md text-title-md text-primary font-bold">
                      Refinor S.A.
                    </span>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-secondary shrink-0 font-bold text-sm">
                      •
                    </div>
                    <span className="font-title-md text-title-md text-primary font-bold">
                      Cofaral
                    </span>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-secondary shrink-0 font-bold text-sm">
                      •
                    </div>
                    <span className="font-title-md text-title-md text-primary font-bold">
                      Ingenios del Tucumán
                    </span>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-secondary shrink-0 font-bold text-sm">
                      •
                    </div>
                    <span className="font-title-md text-title-md text-primary font-bold">
                      Grupo Pueble
                    </span>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-secondary shrink-0 font-bold text-sm">
                      •
                    </div>
                    <span className="font-title-md text-title-md text-primary font-bold">
                      Caminoa
                    </span>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-secondary shrink-0 font-bold text-sm">
                      •
                    </div>
                    <span className="font-title-md text-title-md text-primary font-bold">
                      Frinoa Logística
                    </span>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-secondary shrink-0 font-bold text-sm">
                      •
                    </div>
                    <span className="font-title-md text-title-md text-primary font-bold">
                      Hotel Catalinas
                    </span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-5 relative">
                <div className="relative">
                  <div className="absolute -top-8 -bottom-8 -right-4 w-14 bg-primary-container hidden sm:block rounded-r-lg">
                  </div>
                  <div className="relative bg-surface-container-lowest p-3 rounded-xl shadow-2xl">
                    <div className="relative w-full h-80 sm:h-96 lg:h-[460px]">
                      <Image src="/landing/clients.jpg" alt="Gourmet corporate lunch dish featuring wholesome yellow puree medallions sprinkled with black sesame seeds and fresh colorful salad with grated carrots, sliced ripe tomatoes, and grated beets in an individual take-away container held by a woman's hands on a woven straw dining mat." fill className="object-cover rounded-lg" sizes="(min-width: 1024px) 42vw, 100vw" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full bg-surface-bright py-16 lg:py-24" id="contacto">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col gap-12">
            <div className="text-center max-w-3xl mx-auto flex flex-col gap-3">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-tertiary-container">
                Atención Corporativa Directa
              </span>
              <h2 className="font-headline-lg text-headline-lg text-primary">
                Canales Directos de Contacto
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Comunícate directamente con nuestro equipo gastronómico para coordinar viandas ejecutivas, propuestas a medida y degustaciones corporativas para tu empresa.
              </p>
            </div>
            <div className="max-w-4xl mx-auto w-full">
              <div className="bg-primary text-on-primary p-8 lg:p-12 rounded-2xl shadow-xl flex flex-col gap-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-inverse-surface/80 pb-6">
                  <div className="flex flex-col gap-1">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed">
                      Atención Inmediata
                    </span>
                    <h3 className="font-headline-md text-headline-md text-on-primary">
                      Comunícate con Morá
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-primary-fixed-dim font-body-sm text-body-sm bg-inverse-surface px-4 py-2 rounded-xl">
                    <span className="material-symbols-outlined text-secondary-fixed text-[20px]">
                      pin_drop
                    </span>
                    <span className="">
                      San Miguel de Tucumán, Tucumán
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <a className="group flex flex-col justify-between p-6 rounded-xl bg-inverse-surface hover:bg-surface-container-highest transition-colors duration-200" href={contact.whatsapp} rel="noopener noreferrer" target="_blank">
                    <div className="flex flex-col gap-3">
                      <div className="inline-flex self-start px-3.5 py-1 rounded-full bg-secondary-container text-on-secondary-fixed font-label-sm text-label-sm uppercase font-bold tracking-wider">
                        Contacto & WhatsApp
                      </div>
                      <span className="font-headline-sm text-headline-sm text-on-primary group-hover:text-primary transition-colors">
                        {contact.phone}
                      </span>
                      <span className="font-body-sm text-body-sm text-primary-fixed-dim group-hover:text-on-surface-variant">
                        {contact.whatsappDisplay}
                      </span>
                    </div>
                    <div className="pt-6 flex items-center gap-2 text-secondary-fixed group-hover:text-primary font-label-sm text-label-sm uppercase font-semibold">
                      <span className="material-symbols-outlined text-[18px]">
                        chat
                      </span>
                      <span className="">
                        Chatear ahora
                      </span>
                    </div>
                  </a>
                  <a className="group flex flex-col justify-between p-6 rounded-xl bg-inverse-surface hover:bg-surface-container-highest transition-colors duration-200" href={contact.emailHref}>
                    <div className="flex flex-col gap-3">
                      <div className="inline-flex self-start px-3.5 py-1 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm uppercase font-bold tracking-wider">
                        Email
                      </div>
                      <span className="font-title-md text-title-md text-on-primary group-hover:text-primary transition-colors break-all">
                        {contact.email}
                      </span>
                      <span className="font-body-sm text-body-sm text-primary-fixed-dim group-hover:text-on-surface-variant">
                        Cotizaciones y consultas formales
                      </span>
                    </div>
                    <div className="pt-6 flex items-center gap-2 text-primary-fixed-dim group-hover:text-primary font-label-sm text-label-sm uppercase font-semibold">
                      <span className="material-symbols-outlined text-[18px]">
                        mail
                      </span>
                      <span className="">
                        Enviar correo
                      </span>
                    </div>
                  </a>
                  <a className="group flex flex-col justify-between p-6 rounded-xl bg-inverse-surface hover:bg-surface-container-highest transition-colors duration-200" href={contact.instagram} rel="noopener noreferrer" target="_blank">
                    <div className="flex flex-col gap-3">
                      <div className="inline-flex self-start px-3.5 py-1 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm uppercase font-bold tracking-wider">
                        Redes Sociales
                      </div>
                      <span className="font-title-md text-title-md text-on-primary group-hover:text-primary transition-colors">
                        {contact.instagramHandle}
                      </span>
                      <span className="font-body-sm text-body-sm text-primary-fixed-dim group-hover:text-on-surface-variant">
                        Instagram & Novedades semanales
                      </span>
                    </div>
                    <div className="pt-6 flex items-center gap-2 text-primary-fixed-dim group-hover:text-primary font-label-sm text-label-sm uppercase font-semibold">
                      <span className="material-symbols-outlined text-[18px]">
                        photo_camera
                      </span>
                      <span className="">
                        Ver perfil
                      </span>
                    </div>
                  </a>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-inverse-surface/60 text-primary-fixed-dim font-body-sm text-body-sm">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary-fixed text-[18px]">
                      verified
                    </span>
                    <span className="">
                      Atención de consultas corporativas en menos de 2 horas hábiles
                    </span>
                  </div>
                  <a className="inline-flex items-center gap-2 text-on-tertiary-container hover:underline font-label-sm text-label-sm uppercase tracking-wider font-bold" href={contact.whatsapp} rel="noopener noreferrer" target="_blank">
                    <span className="">
                      Escribir por WhatsApp
                    </span>
                    <span className="material-symbols-outlined text-[16px]">
                      arrow_forward
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
    <footer className="w-full bg-surface-container-lowest text-on-surface pt-16 pb-12 shadow-[0_-1px_8px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 pb-12">
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Image src="/brand/mora-logo.png" alt="Mora Gastronomía" width={44} height={44} className="h-11 w-11 object-contain" />
              <span className="font-headline-sm text-headline-sm text-primary">
                Morá Gastronomía
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
              Soluciones culinarias integrales para empresas, fábricas y oficinas en San Miguel de Tucumán. Nutrición corporativa, puntualidad logística y excelencia gastronómica diaria.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">
                verified
              </span>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Habilitación Bromatológica & Calidad Certificada
              </span>
            </div>
          </div>
          <div className="lg:col-span-2 flex flex-col gap-3">
            <span className="font-title-md text-title-md text-primary font-bold">
              Navegación
            </span>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="#sobre-nosotros">
              Sobre Nosotros
            </a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="#propuesta-de-valor">
              Propuesta de Valor
            </a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="#menus">
              Opciones de Menú
            </a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="#clientes">
              Empresas Clientes
            </a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="#condiciones">
              Términos Operativos
            </a>
          </div>
          <div className="lg:col-span-3 flex flex-col gap-3">
            <span className="font-title-md text-title-md text-primary font-bold">
              Contacto Operativo
            </span>
            <div className="flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                location_on
              </span>
              <span className="">
                San Miguel de Tucumán, Tucumán, Argentina
              </span>
            </div>
            <div className="flex items-center gap-2.5 font-body-sm text-body-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                call
              </span>
              <a className="hover:text-on-surface transition-colors" href={contact.phoneHref}>
                {contact.phone}
              </a>
            </div>
            <div className="flex items-center gap-2.5 font-body-sm text-body-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                mail
              </span>
              <a className="hover:text-on-surface transition-colors" href={contact.emailHref}>
                {contact.email}
              </a>
            </div>
            <div className="flex items-center gap-2.5 font-body-sm text-body-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                forum
              </span>
              <a className="hover:text-on-surface transition-colors" href={contact.whatsapp} rel="noopener noreferrer" target="_blank">
                WhatsApp: {contact.whatsappDisplay}
              </a>
            </div>
          </div>
          <div className="lg:col-span-3 flex flex-col gap-4">
            <span className="font-title-md text-title-md text-primary font-bold">
              Atención Corporativa
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Turnos rotativos, servicios ejecutivos y viandas en planta con esquemas personalizados.
            </p>
            <div className="flex items-center gap-2">
              <a className="inline-flex items-center gap-2 bg-surface-container text-on-surface font-label-sm text-label-sm px-3 py-2 rounded-lg hover:bg-surface-container-high transition-colors" href={contact.instagram} rel="noopener noreferrer" target="_blank">
                <span className="material-symbols-outlined text-[16px]">
                  photo_camera
                </span>
                <span className="">
                  {contact.instagramHandle}
                </span>
              </a>
            </div>
          </div>
        </div>
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-body-sm text-body-sm text-on-surface-variant">
          <p className="">
            © {contact.year} Morá Gastronomía. Todos los derechos reservados. San Miguel de Tucumán.
          </p>
          <div className="flex items-center gap-6">
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Viandas Corporativas • Plantas Industriales • Oficinas
            </span>
          </div>
        </div>
      </div>
    </footer>

    </div>
  )
}
