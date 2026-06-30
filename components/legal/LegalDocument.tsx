import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react'

export type LegalSection = {
  id: string
  title: string
  content: ReactNode
}

type LegalDocumentProps = {
  eyebrow: string
  title: string
  summary: string
  updatedAt: string
  version: string
  sections: LegalSection[]
  kind: 'privacy' | 'terms'
}

export default function LegalDocument({
  eyebrow,
  title,
  summary,
  updatedAt,
  version,
  sections,
  kind,
}: LegalDocumentProps) {
  const Icon = kind === 'privacy' ? ShieldCheck : FileText

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/login" className="flex min-w-0 items-center gap-3">
            <span className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Image src="/logo/Icon-S.png" alt="SEGESA" fill sizes="40px" className="object-contain p-1" />
            </span>
            <span className="truncate text-sm font-semibold">Agenda SEGESA</span>
          </Link>
          <Link href="/login" className="action-btn-ghost flex-shrink-0">
            <ArrowLeft size={16} />
            Volver
          </Link>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-slate-900 text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <Icon size={28} className="text-teal-300" />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">{eyebrow}</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-semibold sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{summary}</p>
          <p className="mt-5 text-xs text-slate-400">Versión {version} · Última actualización: {updatedAt}</p>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8 lg:py-12">
        <nav className="h-fit border-b border-slate-200 pb-6 lg:sticky lg:top-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6" aria-label="Índice del documento">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Contenido</p>
          <div className="mt-3 grid gap-1">
            {sections.map((section, index) => (
              <a key={section.id} href={`#${section.id}`} className="rounded-md px-2 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-teal-700">
                {index + 1}. {section.title}
              </a>
            ))}
          </div>
        </nav>

        <article className="min-w-0">
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-6 border-b border-slate-200 py-7 first:pt-0 last:border-b-0">
              <p className="text-xs font-semibold text-teal-700">{String(index + 1).padStart(2, '0')}</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">{section.title}</h2>
              <div className="legal-copy mt-4 space-y-4 text-sm leading-7 text-slate-600 sm:text-[15px]">
                {section.content}
              </div>
            </section>
          ))}
        </article>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>© 2026 Agenda SEGESA</span>
          <div className="flex gap-4">
            <Link href="/privacidad" className="hover:text-teal-700">Privacidad</Link>
            <Link href="/terminos" className="hover:text-teal-700">Términos de uso</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
