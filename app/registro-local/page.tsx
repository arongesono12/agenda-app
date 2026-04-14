import { notFound } from 'next/navigation'
import LocalRegisterForm from '@/components/LocalRegisterForm'

export default function RegistroLocalPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return <LocalRegisterForm />
}
