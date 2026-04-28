import { Resend } from 'resend'

type SendAgendaEmailInput = {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

type SendAgendaEmailResult =
  | { ok: true; skipped?: false; id?: string | null }
  | { ok: false; skipped: true; error: string }
  | { ok: false; skipped?: false; error: string }

let resendClient: Resend | null = null

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return null
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey)
  }

  return resendClient
}

export function getAgendaEmailFrom() {
  return process.env.RESEND_FROM_EMAIL || 'Agenda <onboarding@resend.dev>'
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendAgendaEmail({
  to,
  subject,
  html,
  text,
}: SendAgendaEmailInput): Promise<SendAgendaEmailResult> {
  const resend = getResendClient()

  if (!resend) {
    return {
      ok: false,
      skipped: true,
      error: 'RESEND_API_KEY no esta configurada.',
    }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getAgendaEmailFrom(),
      to,
      subject,
      html,
      text,
    })

    if (error) {
      return {
        ok: false,
        error: error.message,
      }
    }

    return {
      ok: true,
      id: data?.id ?? null,
    }
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo enviar el correo.',
    }
  }
}
