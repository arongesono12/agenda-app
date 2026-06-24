import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlarmClock,
  ArrowRight,
  Building2,
  CalendarX2,
  Check,
  Clock3,
  Layers3,
  LockKeyhole,
  Mail,
  MonitorCheck,
  Phone,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react'
import LandingHeader from '@/components/LandingHeader'

const painPoints = [
  {
    title: 'Horarios conflictivos',
    text: 'Reuniones, tareas y responsables dispersos dificultan la coordinacion diaria.',
    icon: CalendarX2,
  },
  {
    title: 'Vista unificada',
    text: 'Un solo panel permite consultar agenda, avance, alertas y responsables por area.',
    icon: MonitorCheck,
  },
  {
    title: 'Falta de seguimiento',
    text: 'Sin historial ni trazabilidad, las acciones criticas pierden contexto operativo.',
    icon: Clock3,
  },
  {
    title: 'Recordatorios automaticos',
    text: 'Las alertas de vencimiento mantienen visibles los compromisos pendientes.',
    icon: AlarmClock,
  },
]

const powerModules = [
  {
    title: 'Planificacion de grupos inteligente',
    text: 'Organiza tareas por departamentos, responsables y prioridades con una vista de control clara.',
    icon: Users,
  },
  {
    title: 'Integracion operativa',
    text: 'Conecta agenda, dashboard, cronograma, alertas e historial en un flujo unico de trabajo.',
    icon: Layers3,
  },
  {
    title: 'Seguridad y permisos',
    text: 'Control por roles para proteger acciones de gestion, edicion, consulta y configuracion.',
    icon: ShieldCheck,
  },
  {
    title: 'Acceso movil multiplataforma',
    text: 'Interfaces responsivas para revisar tareas, vencimientos y actividad desde cualquier pantalla.',
    icon: Smartphone,
  },
]

const testimonials = [
  {
    name: 'Doha Rocavio',
    role: 'Directora de Operaciones',
    quote: 'La agenda nos ayudo a pasar de reportes dispersos a una vision diaria de prioridades.',
    initials: 'DR',
  },
  {
    name: 'Asanna Plumenio',
    role: 'Responsable de Gestion',
    quote: 'Ahora los vencimientos, responsables y avances se revisan desde un unico punto.',
    initials: 'AP',
  },
  {
    name: 'Datolo Fonias',
    role: 'Coordinador Tecnico',
    quote: 'El historial nos da contexto real para decidir con rapidez y menos friccion.',
    initials: 'DF',
  },
  {
    name: 'Dertino Narhivo',
    role: 'Supervisor de Area',
    quote: 'La visibilidad de tareas pendientes mejoro la coordinacion entre departamentos.',
    initials: 'DN',
  },
]

const plans = [
  {
    name: 'Esencial',
    tone: 'slate',
    items: ['Planificacion diaria', 'Gestion de tareas', 'Alertas basicas', 'Historial operativo', 'Panel de consulta'],
  },
  {
    name: 'Profesional',
    tone: 'teal',
    items: ['Agenda avanzada', 'Dashboard ejecutivo', 'Reportes de productividad', 'Roles y permisos', 'Organismos y equipos'],
  },
  {
    name: 'Empresarial',
    tone: 'blue',
    items: ['Control multi-equipo', 'Facturacion y planes', 'Auditoria de cambios', 'Soporte institucional', 'Configuracion ampliada'],
  },
]

const footerLinks = ['Agenda', 'Dashboard', 'Cronograma', 'Alertas', 'Historial']

const socialLinks = [
  {
    label: 'Facebook',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
        <path d="M14.2 8.1V6.7c0-.7.5-.9.8-.9h2V2.4l-2.8-.1c-3.1 0-3.8 2.3-3.8 3.8v2H7.9v3.8h2.5v9.8h3.8v-9.8h3.1l.4-3.8h-3.5Z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="3.4" />
        <circle cx="16.8" cy="7.2" r="0.7" className="fill-current stroke-none" />
      </svg>
    ),
  },
  {
    label: 'X',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
        <path d="M14.1 10.4 21.3 2h-2.1l-6 7-4.8-7H2.7l7.6 11.1L2.7 22h2.1l6.4-7.4 5.1 7.4h5.7l-7.9-11.6Zm-2.3 2.7-.7-1L5 3.6h2.4l4.7 6.7.7 1 6.4 9.1h-2.4l-5-7.3Z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
        <path d="M6.5 8.8H3V21h3.5V8.8ZM4.8 3C3.6 3 2.8 3.8 2.8 4.9c0 1 .8 1.9 2 1.9s2-.8 2-1.9C6.8 3.8 6 3 4.8 3ZM21.2 14c0-3.3-1.8-5.4-4.5-5.4-2 0-3 1.1-3.5 1.9V8.8H9.7V21h3.5v-6.8c0-1.7.9-2.7 2.3-2.7 1.3 0 2.1.9 2.1 2.7V21h3.5v-7Z" />
      </svg>
    ),
  },
]

export default function LandingPage() {
  if (process.env.NODE_ENV === 'production') {
    redirect('/login')
  }

  return (
    <div className="min-h-screen text-slate-950">
      <LandingHeader />
      <div className="mx-auto w-full max-w-[1560px] px-3 pb-3 sm:px-6 lg:px-8 lg:pb-5">
        <main className="page-stack">
          <section id="soluciones" className="surface-panel-strong relative left-1/2 w-screen -translate-x-1/2 overflow-hidden rounded-none border-x-0 border-t-0 p-0">
            <div className="relative min-h-[560px] overflow-hidden bg-slate-950 lg:min-h-[590px]">
              <Image
                src="/imagencorporativo.png"
                alt="Equipo corporativo revisando indicadores"
                fill
                sizes="100vw"
                className="object-cover object-center"
                priority
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,47,73,0.86)_0%,rgba(8,47,73,0.70)_35%,rgba(8,47,73,0.28)_68%,rgba(8,47,73,0.08)_100%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04)_0%,rgba(15,23,42,0.18)_58%,rgba(248,250,252,0.96)_100%)]" />

              <div className="relative z-10 grid min-h-[520px] grid-cols-1 items-center gap-5 px-5 pb-10 pt-24 sm:px-10 lg:grid-cols-[0.50fr_0.50fr] lg:gap-2 lg:px-16 lg:pb-12 lg:pt-28">
                <div className="max-w-2xl">
                  <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-50">
                    Agenda corporativa
                  </span>
                  <h1 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-[3.55rem]">
                    Domina tu tiempo corporativo. La agenda que impulsa la productividad.
                  </h1>
                  <p className="mt-4 max-w-xl text-base leading-8 text-slate-100 sm:text-lg">
                    Sincronizacion total, gestion de equipos y optimizacion de recursos en una plataforma unificada.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Link href="/login" className="action-btn-primary min-h-12 px-5">
                      <LockKeyhole size={17} />
                      Empezar ahora
                    </Link>
                    <Link href="#contacto" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/15">
                      Registrarse
                      <ArrowRight size={17} />
                    </Link>
                  </div>
                </div>

                <div className="mx-auto w-full max-w-[680px] lg:-ml-8 lg:mr-0 lg:max-w-[720px]">
                  <Image
                    src="/portatilmockup.png"
                    alt="Portatil mostrando el dashboard ejecutivo de la agenda"
                    width={1360}
                    height={856}
                    sizes="(max-width: 768px) 88vw, (max-width: 1280px) 44vw, 720px"
                    className="h-auto w-full drop-shadow-[0_28px_58px_rgba(15,23,42,0.34)]"
                    priority
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="surface-panel-strong p-5 sm:p-6" id="funciones">
            <div className="text-center">
              <span className="section-label">Tus reuniones no son un caos</span>
              <h2 className="section-title mt-4">De la dispersion operativa a una agenda unificada.</h2>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              {painPoints.map(({ title, text, icon: Icon }, index) => (
                <div key={title} className="relative">
                  <article className="surface-panel h-full p-5 text-center">
                    <div className="flex min-h-20 items-center justify-center">
                      <Icon size={62} strokeWidth={1.65} className="text-teal-700" />
                    </div>
                    <h3 className="mt-5 text-base font-semibold uppercase leading-6 text-slate-900">{title}</h3>
                    <p className="section-copy mt-2">{text}</p>
                  </article>
                  {index < painPoints.length - 1 && (
                    <span className="pointer-events-none absolute left-full top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-400 shadow-[0_8px_18px_rgba(15,23,42,0.08)] md:inline-flex">
                      VS
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.86fr]">
            <div className="surface-panel-strong p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="section-label">Potencia operativa</span>
                  <h2 className="section-title mt-4">Descubre la potencia del Plan de Trabajo.</h2>
                </div>
                <Link href="/login" className="action-btn self-start sm:self-auto">
                  Ver sistema
                  <ArrowRight size={15} />
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {powerModules.map(({ title, text, icon: Icon }) => (
                  <article key={title} className="surface-panel p-5 text-center">
                    <div className="flex min-h-20 items-center justify-center">
                      <Icon size={64} strokeWidth={1.65} className="text-teal-700" />
                    </div>
                    <h3 className="mt-5 text-base font-semibold text-slate-900">{title}</h3>
                    <p className="section-copy mt-2">{text}</p>
                    <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-teal-700 transition-colors hover:text-teal-900">
                      Saber mas
                    </Link>
                  </article>
                ))}
              </div>
            </div>

            <div id="clientes" className="surface-panel-strong p-5 sm:p-6">
              <div className="text-center">
                <span className="section-label">Clientes satisfechos</span>
                <h2 className="mt-4 text-xl font-semibold text-slate-900">Equipos que necesitan claridad diaria.</h2>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {testimonials.map((item) => (
                  <article key={item.name} className="surface-panel p-4 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-sm font-semibold text-teal-700">
                      {item.initials}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.role}</p>
                    <p className="mt-3 text-xs leading-5 text-slate-600">{item.quote}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="planes" className="surface-panel-strong p-5 sm:p-6">
            <div className="text-center">
              <span className="section-label">Planes adaptados</span>
              <h2 className="section-title mt-4">Elige el nivel de control que necesita tu empresa.</h2>
            </div>
            <div className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={plan.tone === 'teal' ? 'surface-panel-strong overflow-hidden border-teal-200' : 'surface-panel overflow-hidden'}
                >
                  <div className={plan.tone === 'teal' ? 'bg-teal-600 px-5 py-4 text-white' : plan.tone === 'blue' ? 'bg-slate-800 px-5 py-4 text-white' : 'border-b border-white/70 bg-white/40 px-5 py-4 text-slate-900'}>
                    <h3 className="text-base font-semibold">{plan.name}</h3>
                  </div>
                  <div className="space-y-3 p-5">
                    {plan.items.map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm text-slate-600">
                        <Check size={16} className="mt-0.5 flex-shrink-0 text-teal-700" />
                        <span>{item}</span>
                      </div>
                    ))}
                    <Link href="#contacto" className="action-btn-primary mt-5 w-full justify-center">
                      Saber mas
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="contacto" className="surface-panel-strong grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <span className="section-label">Siguiente nivel</span>
              <h2 className="section-title mt-4">Lleva tu productividad al siguiente nivel.</h2>
              <p className="section-copy mt-3">
                Solicita acceso o agenda una demo para presentar el flujo completo de agenda, alertas, dashboard, historial y gestion por roles.
              </p>
              <div className="mt-6 space-y-3">
                <div className="surface-panel flex items-center gap-3 rounded-2xl border-transparent p-3">
                  <Mail size={18} className="text-teal-700" />
                  <span className="text-sm font-semibold text-slate-700">correo corporativo</span>
                </div>
                <div className="surface-panel flex items-center gap-3 rounded-2xl border-transparent p-3">
                  <Phone size={18} className="text-teal-700" />
                  <span className="text-sm font-semibold text-slate-700">telefono institucional</span>
                </div>
                <div className="surface-panel flex items-center gap-3 rounded-2xl border-transparent p-3">
                  <Building2 size={18} className="text-teal-700" />
                  <span className="text-sm font-semibold text-slate-700">organismo o departamento</span>
                </div>
              </div>
            </div>

            <form className="surface-panel-dark p-4 text-white sm:p-5" action="/registro" method="get">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="sr-only">Nombre</span>
                  <input
                    name="nombre"
                    type="text"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none transition-colors placeholder:text-slate-300 focus:border-teal-200/70 focus:bg-white/[0.10]"
                    placeholder="Nombre"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">Correo corporativo</span>
                  <input
                    name="email"
                    type="email"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none transition-colors placeholder:text-slate-300 focus:border-teal-200/70 focus:bg-white/[0.10]"
                    placeholder="Correo corporativo"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">Telefono</span>
                  <input
                    name="telefono"
                    type="tel"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none transition-colors placeholder:text-slate-300 focus:border-teal-200/70 focus:bg-white/[0.10]"
                    placeholder="Telefono"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">Organismo</span>
                  <input
                    name="organismo"
                    type="text"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none transition-colors placeholder:text-slate-300 focus:border-teal-200/70 focus:bg-white/[0.10]"
                    placeholder="Organismo"
                  />
                </label>
              </div>
              <label className="mt-3 block">
                <span className="sr-only">Mensaje</span>
                <textarea
                  name="mensaje"
                  className="min-h-32 w-full resize-y rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none transition-colors placeholder:text-slate-300 focus:border-teal-200/70 focus:bg-white/[0.10]"
                  placeholder="Mensaje"
                />
              </label>
              <button type="submit" className="action-btn-primary mt-4 w-full justify-center">
                Registrarse
                <ArrowRight size={15} />
              </button>
            </form>
          </section>
        </main>

        <footer className="surface-panel-strong relative left-1/2 mt-5 w-screen -translate-x-1/2 overflow-hidden rounded-none border-x-0 border-b-0 p-5 sm:p-6">
          <div className="mx-auto grid max-w-[1560px] grid-cols-1 gap-6 px-0 lg:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
            <div className="flex items-start gap-4">
              <span className="logo-panel relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-2xl border shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
                <Image src="/logo/Icon-S.png" alt="Logo de SEGESA" fill sizes="44px" className="object-contain p-1.5" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-teal-700">SEGESA</p>
                <p className="mt-1 text-base font-semibold text-slate-900">Plan de Trabajo</p>
                <p className="section-copy mt-2 max-w-2xl">
                  Sistema de gestion de tareas, alertas, cronogramas e indicadores para mantener el seguimiento operativo con acceso protegido.
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">Quick links</p>
              <div className="mt-3 grid gap-2">
                {footerLinks.map((item) => (
                  <Link key={item} href="/login" className="text-sm text-slate-500 transition-colors hover:text-teal-700">
                    {item}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">Contacto</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-500">
                <span>Correo corporativo</span>
                <span>Telefono</span>
                <span>Mensaje</span>
                <span>Soporte</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {socialLinks.map((social) => (
                  <Link
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-teal-50 hover:text-teal-700"
                  >
                    {social.icon}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="mx-auto mt-5 max-w-[1560px] border-t border-white/70 pt-4 text-center lg:px-8">
            <p className="text-xs text-slate-500">Copyright 2026 SEGESA. Plataforma interna de control operativo.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
