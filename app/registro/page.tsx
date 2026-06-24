import RegisterForm from '@/components/RegisterForm'

export default async function RegistroPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; invitacion?: string; nombre?: string; email?: string; organismo?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  return (
    <RegisterForm
      nextPath={resolvedSearchParams?.next || '/organismos/nuevo'}
      invitacionToken={resolvedSearchParams?.invitacion}
      initialFullName={resolvedSearchParams?.nombre}
      initialEmail={resolvedSearchParams?.email}
      initialOrganismoName={resolvedSearchParams?.organismo}
    />
  )
}
