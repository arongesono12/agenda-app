'use client'
import { useState, useEffect, useCallback } from 'react'
import { History, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Historial } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const PAGE_SIZE = 25

const CHANGE_COLOR: Record<string, string> = {
  Creacion: 'bg-teal-50 text-teal-700 border-teal-200',
  'Creación': 'bg-teal-50 text-teal-700 border-teal-200',
  'Cambio de Estado': 'bg-sky-50 text-sky-700 border-sky-200',
  'Actualizacion % Avance': 'bg-amber-50 text-amber-700 border-amber-200',
  'Actualización % Avance': 'bg-amber-50 text-amber-700 border-amber-200',
  Eliminacion: 'bg-rose-50 text-rose-700 border-rose-200',
  'Eliminación': 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function HistorialPage() {
  const [rows, setRows] = useState<Historial[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, count } = await supabase
      .from('historial')
      .select('*', { count: 'exact' })
      .order('fecha', { ascending: false })
      .range(from, to)
    setRows((data ?? []) as Historial[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page])

  useEffect(() => {
    fetch()
  }, [fetch])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const formatDateTime = (dt: string) => {
    try {
      return format(parseISO(dt), "dd MMM yyyy '·' HH:mm", { locale: es })
    } catch {
      return dt
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Historial de cambios"
        subtitle="Auditoria y trazabilidad de acciones registradas sobre tareas y avances."
        icon={<History size={22} />}
        actions={
          <button onClick={fetch} className="action-btn h-12 w-12 rounded-2xl p-0">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="surface-panel table-shell overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-white/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">{total} registros en total</p>
            <p className="text-xs text-slate-500">Los cambios se registran automaticamente al operar el sistema.</p>
          </div>
          <span className="section-label self-start sm:self-auto">Bitacora</span>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw size={24} className="mx-auto animate-spin text-teal-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <History size={30} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No hay registros en el historial</p>
            <p className="mt-1 text-xs text-slate-500">Apareceran aqui de forma automatica.</p>
          </div>
        ) : (
          <>
            <div className="mobile-card-list p-4 md:hidden">
              {rows.map((row) => (
                <article key={row.id} className="mobile-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${CHANGE_COLOR[row.tipo_cambio] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                      {row.tipo_cambio}
                    </span>
                    <span className="text-xs text-slate-500">{formatDateTime(row.fecha)}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-800">{row.tarea_nombre ?? '-'}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <div>
                      <p className="font-semibold text-slate-700">Usuario</p>
                      <p className="mt-1">{row.usuario ?? 'Sistema'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Módulo</p>
                      <p className="mt-1">{row.modulo}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p><span className="font-semibold text-slate-700">Anterior:</span> {row.valor_anterior ?? '-'}</p>
                    <p className="mt-1"><span className="font-semibold text-slate-700">Nuevo:</span> {row.valor_nuevo ?? '-'}</p>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-slate-500">{row.observaciones ?? '-'}</p>
                </article>
              ))}
            </div>

            <div className="hidden md:block">
            <div className="table-container">
              <table className="w-full min-w-[1180px] text-sm">
                <thead>
                  <tr className="border-b border-white/70 bg-white/40">
                    {['Fecha', 'Usuario', 'Tarea', 'Modulo', 'Cambio', 'Valor anterior', 'Valor nuevo', 'Observaciones'].map((h) => (
                      <th key={h} className="table-header-cell whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {rows.map((row, index) => (
                    <tr key={row.id} className={index % 2 === 0 ? 'bg-white/10 hover:bg-white/50' : 'bg-white/30 hover:bg-white/60'}>
                      <td className="px-4 py-3 text-xs font-medium text-slate-500">{formatDateTime(row.fecha)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900/5 text-xs font-semibold text-slate-700">
                            {(row.usuario ?? 'S').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold text-slate-700">{row.usuario ?? 'Sistema'}</span>
                        </div>
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-800">{row.tarea_nombre ?? '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{row.modulo}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${CHANGE_COLOR[row.tipo_cambio] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                          {row.tipo_cambio}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{row.valor_anterior ?? '-'}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-teal-700">{row.valor_nuevo ?? '-'}</td>
                      <td className="max-w-[220px] px-4 py-3 text-xs text-slate-500">{row.observaciones ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/70 px-5 py-4">
                <p className="text-xs text-slate-500">
                  Pagina {page + 1} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="action-btn h-10 w-10 rounded-2xl p-0 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="action-btn h-10 w-10 rounded-2xl p-0 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
