import LoginForm from '@/components/LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <LoginForm nextPath={resolvedSearchParams?.next || '/'} />
    </div>
  )
}
