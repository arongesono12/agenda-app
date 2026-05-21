import { redirect } from 'next/navigation'

export default async function OrganismoDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await params
  // Redirigir al dashboard principal — el slug ya está resuelto en el middleware
  redirect('/dashboard')
}
