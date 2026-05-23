from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


PDF_PATH = "docs/diagramas-aplicacion.pdf"
PAGE_W, PAGE_H = landscape(A4)


PALETTE = {
    "ink": colors.HexColor("#0f172a"),
    "muted": colors.HexColor("#64748b"),
    "line": colors.HexColor("#94a3b8"),
    "soft": colors.HexColor("#f8fafc"),
    "teal": colors.HexColor("#0f766e"),
    "teal_soft": colors.HexColor("#ccfbf1"),
    "blue_soft": colors.HexColor("#dbeafe"),
    "amber_soft": colors.HexColor("#fef3c7"),
    "rose_soft": colors.HexColor("#ffe4e6"),
    "green_soft": colors.HexColor("#ecfdf5"),
    "slate": colors.HexColor("#e2e8f0"),
    "yellow_soft": colors.HexColor("#fefce8"),
}


def box(c, x, y, w, h, title, lines=(), fill="soft", stroke="slate"):
    c.setFillColor(PALETTE[fill])
    c.setStrokeColor(PALETTE[stroke])
    c.roundRect(x, y, w, h, 8, fill=1, stroke=1)
    c.setFillColor(PALETTE["ink"])
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(x + w / 2, y + h - 18, title)
    c.setFillColor(colors.HexColor("#475569"))
    c.setFont("Helvetica", 8)
    for i, line in enumerate(lines):
        c.drawCentredString(x + w / 2, y + h - 32 - (i * 11), line)


def section_title(c, title, subtitle, tag):
    c.setFillColor(PALETTE["ink"])
    c.setFont("Helvetica-Bold", 19)
    c.drawString(16 * mm, PAGE_H - 18 * mm, title)
    c.setFillColor(PALETTE["muted"])
    c.setFont("Helvetica", 8.5)
    c.drawString(16 * mm, PAGE_H - 24 * mm, subtitle)
    c.setFillColor(colors.HexColor("#f0fdfa"))
    c.setStrokeColor(colors.HexColor("#99f6e4"))
    c.roundRect(PAGE_W - 56 * mm, PAGE_H - 24 * mm, 40 * mm, 8 * mm, 4 * mm, fill=1, stroke=1)
    c.setFillColor(PALETTE["teal"])
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(PAGE_W - 36 * mm, PAGE_H - 21.3 * mm, tag)
    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.line(16 * mm, PAGE_H - 30 * mm, PAGE_W - 16 * mm, PAGE_H - 30 * mm)


def arrow(c, x1, y1, x2, y2):
    c.setStrokeColor(PALETTE["line"])
    c.setLineWidth(1.15)
    c.line(x1, y1, x2, y2)
    angle = 0
    if abs(x2 - x1) >= abs(y2 - y1):
        angle = 0 if x2 >= x1 else 180
    else:
        angle = 90 if y2 >= y1 else -90
    c.saveState()
    c.translate(x2, y2)
    c.rotate(angle)
    c.setFillColor(PALETTE["line"])
    c.line(-5, -3, 0, 0)
    c.line(-5, 3, 0, 0)
    c.restoreState()


def note(c, text):
    x, y, w, h = 16 * mm, 10 * mm, PAGE_W - 32 * mm, 13 * mm
    c.setFillColor(PALETTE["soft"])
    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.roundRect(x, y, w, h, 6, fill=1, stroke=1)
    c.setFillColor(colors.HexColor("#475569"))
    c.setFont("Helvetica", 8)
    c.drawString(x + 6, y + 7, text)


def draw_user_flow(c):
    section_title(
        c,
        "Flujo funcional para usuarios",
        "Autenticación, organismo activo, permisos por rol, tareas oficiales, asignaciones múltiples y checklist personal.",
        "Agenda App",
    )

    y0 = PAGE_H - 64 * mm
    box(c, 18 * mm, y0, 44 * mm, 18 * mm, "Usuario entra", ["Login o sesión activa"], "blue_soft")
    box(c, 76 * mm, y0, 42 * mm, 18 * mm, "¿Autenticado?", ["Supabase Auth"], "amber_soft")
    box(c, 132 * mm, y0, 52 * mm, 18 * mm, "Perfil + organismo", ["UserSessionProvider"], "blue_soft")
    box(c, 198 * mm, y0, 52 * mm, 18 * mm, "Permisos por rol", ["Sidebar y acciones"], "yellow_soft")
    arrow(c, 62 * mm, y0 + 9 * mm, 76 * mm, y0 + 9 * mm)
    arrow(c, 118 * mm, y0 + 9 * mm, 132 * mm, y0 + 9 * mm)
    arrow(c, 184 * mm, y0 + 9 * mm, 198 * mm, y0 + 9 * mm)

    role_y = PAGE_H - 96 * mm
    box(c, 26 * mm, role_y, 48 * mm, 22 * mm, "Administrador", ["Crea, edita, elimina", "asigna y gestiona"], "teal_soft")
    box(c, 88 * mm, role_y, 48 * mm, 22 * mm, "Supervisor", ["Crea y reasigna", "según alcance"], "amber_soft")
    box(c, 150 * mm, role_y, 48 * mm, 22 * mm, "Responsable", ["Registra avances", "completa su parte"], "green_soft")
    box(c, 212 * mm, role_y, 48 * mm, 22 * mm, "Consulta", ["Solo lectura", "reportes permitidos"], "soft")

    for x in (50, 112, 174, 236):
        arrow(c, 224 * mm, y0, x * mm, role_y + 22 * mm)

    flow_y = PAGE_H - 142 * mm
    box(c, 16 * mm, flow_y, 44 * mm, 20 * mm, "Agenda diaria", ["Pendientes y vencidas"], "soft")
    box(c, 74 * mm, flow_y, 48 * mm, 20 * mm, "Tarea oficial", ["fechas, prioridad, estado"], "teal_soft")
    box(c, 136 * mm, flow_y, 52 * mm, 20 * mm, "¿Múltiples asignaciones?", ["tarea_asignaciones"], "amber_soft")
    box(c, 202 * mm, flow_y, 52 * mm, 20 * mm, "Cada usuario", ["completa su parte"], "green_soft")
    arrow(c, 60 * mm, flow_y + 10 * mm, 74 * mm, flow_y + 10 * mm)
    arrow(c, 122 * mm, flow_y + 10 * mm, 136 * mm, flow_y + 10 * mm)
    arrow(c, 188 * mm, flow_y + 10 * mm, 202 * mm, flow_y + 10 * mm)

    close_y = PAGE_H - 178 * mm
    box(c, 136 * mm, close_y, 52 * mm, 20 * mm, "No múltiples", ["cierra directamente"], "teal_soft")
    box(c, 202 * mm, close_y, 52 * mm, 20 * mm, "¿Todos terminaron?", ["validación global"], "amber_soft")
    box(c, 136 * mm, close_y - 30 * mm, 52 * mm, 20 * mm, "Tarea Completada", ["notifica admins"], "teal_soft")
    box(c, 202 * mm, close_y - 30 * mm, 52 * mm, 20 * mm, "Sigue En Proceso", ["admin ve faltantes"], "rose_soft")
    arrow(c, 162 * mm, flow_y, 162 * mm, close_y + 20 * mm)
    arrow(c, 228 * mm, flow_y, 228 * mm, close_y + 20 * mm)
    arrow(c, 202 * mm, close_y + 10 * mm, 188 * mm, close_y - 20 * mm)
    arrow(c, 228 * mm, close_y, 228 * mm, close_y - 10 * mm)

    personal_y = PAGE_H - 196 * mm
    box(c, 16 * mm, personal_y, 44 * mm, 20 * mm, "Mis tareas", ["Checklist personal"], "soft")
    box(c, 74 * mm, personal_y, 48 * mm, 20 * mm, "Completar pendiente", ["se oculta de pendientes"], "soft")
    arrow(c, 60 * mm, personal_y + 10 * mm, 74 * mm, personal_y + 10 * mm)

    note(c, "Regla clave: en tareas multi-asignadas, cada responsable completa solo su parte; la tarea global se cierra cuando todos finalizan.")


def draw_dev_flow(c):
    section_title(
        c,
        "Flujo técnico para desarrolladores",
        "Next.js App Router, proveedores globales, rutas API, control de acceso, Supabase, correo y facturación.",
        "Next.js + Supabase",
    )

    top = PAGE_H - 64 * mm
    box(c, 16 * mm, top, 52 * mm, 20 * mm, "Next.js App Router", ["app/layout.tsx", "páginas + API"], "soft")
    box(c, 82 * mm, top, 52 * mm, 20 * mm, "AppChrome", ["Theme, Toast", "Session + Sidebar"], "soft")
    box(c, 148 * mm, top, 52 * mm, 20 * mm, "Sesión y permisos", ["UserSessionProvider", "organismo activo"], "yellow_soft")
    box(c, 214 * mm, top, 52 * mm, 20 * mm, "Supabase Auth", ["perfiles_usuario", "miembros"], "blue_soft")
    arrow(c, 68 * mm, top + 10 * mm, 82 * mm, top + 10 * mm)
    arrow(c, 134 * mm, top + 10 * mm, 148 * mm, top + 10 * mm)
    arrow(c, 200 * mm, top + 10 * mm, 214 * mm, top + 10 * mm)

    mid = PAGE_H - 134 * mm
    box(c, 16 * mm, mid, 58 * mm, 82 * mm, "Páginas UI", [
        "/, /mis-tareas, /dashboard",
        "/historial, /alertas",
        "/cronograma, /estadisticas",
        "/organismos/[slug]/*",
        "Componentes de tareas y UI",
    ], "soft")

    box(c, 90 * mm, mid, 66 * mm, 82 * mm, "Rutas API", [
        "/api/tareas",
        "/api/historial",
        "/api/mis-tareas",
        "/api/dashboard / estadisticas",
        "/api/alertas",
        "/api/organismos/*",
        "/api/billing/*",
    ], "teal_soft")

    box(c, 172 * mm, mid + 28 * mm, 52 * mm, 40 * mm, "Seguridad", [
        "access-control.ts",
        "role-capabilities.ts",
        "server-access.ts",
        "task-scope.ts",
    ], "yellow_soft")

    box(c, 238 * mm, mid, 45 * mm, 82 * mm, "Supabase DB", [
        "tareas",
        "tarea_asignaciones",
        "historial / alertas",
        "responsables",
        "mis_tareas",
        "organismos",
        "suscripciones",
    ], "blue_soft")

    arrow(c, 74 * mm, mid + 41 * mm, 90 * mm, mid + 41 * mm)
    arrow(c, 156 * mm, mid + 50 * mm, 172 * mm, mid + 50 * mm)
    arrow(c, 224 * mm, mid + 50 * mm, 238 * mm, mid + 50 * mm)
    arrow(c, 156 * mm, mid + 28 * mm, 238 * mm, mid + 28 * mm)

    low = PAGE_H - 186 * mm
    box(c, 90 * mm, low, 66 * mm, 20 * mm, "Email Resend", ["asignaciones y finalización"], "soft")
    box(c, 172 * mm, low, 52 * mm, 20 * mm, "Stripe Billing", ["checkout, portal, webhook"], "soft")
    arrow(c, 123 * mm, mid, 123 * mm, low + 20 * mm)
    arrow(c, 198 * mm, mid, 198 * mm, low + 20 * mm)

    note(c, "La lógica crítica vive en /api/tareas y /api/historial; el alcance se calcula por rol, organismo activo y asignaciones.")


def main():
    c = canvas.Canvas(PDF_PATH, pagesize=landscape(A4))
    draw_user_flow(c)
    c.showPage()
    draw_dev_flow(c)
    c.save()
    print(PDF_PATH)


if __name__ == "__main__":
    main()
