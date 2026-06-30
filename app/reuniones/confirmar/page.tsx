import { Suspense } from 'react'
import MeetingConfirmationForm from '@/components/MeetingConfirmationForm'

export default function ConfirmarReunionPage() {
  return (
    <Suspense fallback={null}>
      <MeetingConfirmationForm />
    </Suspense>
  )
}
