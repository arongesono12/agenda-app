import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

export default function ForbiddenPage() {
  return (
    <div className="page-stack">
      <div className="surface-panel-strong mx-auto max-w-3xl p-8 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <ShieldAlert size={28} />
        </div>
        <h1 className="mt-5 text-3xl font-semibold text-slate-900">Acceso denegado</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
          Tu usuario no tiene permisos suficientes para entrar en este modulo. Si necesitas acceso,
          solicita que se te asigne un rol compatible.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="action-btn-primary justify-center">
            Volver a la agenda
          </Link>
          <Link href="/perfil" className="action-btn-ghost justify-center">
            Ver mi perfil
          </Link>
        </div>
      </div>
    </div>
  )
}
