import { Suspense } from 'react'
import UpdatePasswordForm from '@/components/UpdatePasswordForm'

export default function ActualizarPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <Suspense fallback={null}>
        <UpdatePasswordForm />
      </Suspense>
    </div>
  )
}
