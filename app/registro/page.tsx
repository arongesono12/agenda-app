import RegisterForm from '@/components/RegisterForm'

export default async function RegistroPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; invitacion?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  return (
    <RegisterForm
      nextPath={resolvedSearchParams?.next || '/organismos/nuevo'}
      invitacionToken={resolvedSearchParams?.invitacion}
    />
  )
}
