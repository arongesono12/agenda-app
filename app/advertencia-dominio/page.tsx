import DomainAcquisitionWarning from '@/components/DomainAcquisitionWarning'

export default async function DomainWarningPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  return <DomainAcquisitionWarning nextPath={resolvedSearchParams?.next || '/'} />
}
