# Agenda App — Organismos Funcionales
### Architecture Design Document

| | |
|---|---|
| **Estado** | Borrador v1.0 |
| **Fecha** | Mayo 2026 |
| **Autor** | Aron Esono Ondo Eyang|
| **Revisión requerida** | Ingeniería · Producto · Seguridad |

---

## TL;DR

Agenda App opera hoy como un sistema de agenda de tarea única para una sola organización. Este documento describe cómo convertirla en una **plataforma multi-organismo** donde cada entidad —empresa, institución o equipo— tenga su propio espacio aislado, con usuarios propios, roles internos y una suscripción de pago. El modelo se inspira directamente en cómo Dropbox separa equipos (Business, Teams) dentro de una infraestructura compartida, manteniendo aislamiento de datos por defecto y enrutando cada acción al contexto correcto del tenant.

---

## Índice

- [1. Motivación y contexto](#1-motivación-y-contexto)
- [2. Principios de diseño](#2-principios-de-diseño)
- [3. Arquitectura de alto nivel](#3-arquitectura-de-alto-nivel)
- [4. Modelo de datos](#4-modelo-de-datos)
- [5. Sistema de roles por organismo](#5-sistema-de-roles-por-organismo)
- [6. Tipos de cuenta y planes](#6-tipos-de-cuenta-y-planes)
- [7. Pipeline de pagos](#7-pipeline-de-pagos)
- [8. Aislamiento y seguridad de datos](#8-aislamiento-y-seguridad-de-datos)
- [9. Cambios en la capa de aplicación](#9-cambios-en-la-capa-de-aplicación)
- [10. Flujos críticos](#10-flujos-críticos)
- [11. Migración sin downtime](#11-migración-sin-downtime)
- [12. Roadmap de implementación](#12-roadmap-de-implementación)
- [13. Trade-offs y decisiones abiertas](#13-trade-offs-y-decisiones-abiertas)

---

## 1. Motivación y contexto

### El problema

El sistema actual asume que existe exactamente un organismo. Todas las tareas, responsables, departamentos y alertas comparten la misma base de datos sin ninguna frontera de tenant:

```
                     ┌─────────────────────────────────┐
                     │          Supabase DB             │
                     │                                  │
  Usuario A ─────────┤──► tareas (sin scope)            │
  Usuario B ─────────┤──► responsables (sin scope)      │
  Usuario C ─────────┤──► alertas (sin scope)           │
                     │                                  │
                     └─────────────────────────────────┘
```

Esto significa que escalar a un segundo cliente requiere levantar una nueva instancia completa del proyecto, lo que es insostenible operativamente y imposible de mantener.

### La solución

Introducir el concepto de **Organismo** como la unidad raíz del sistema. Cada organismo es un tenant aislado. Los usuarios pertenecen a uno o varios organismos con roles independientes en cada uno. Los datos nunca atraviesan la frontera del organismo.

```
                     ┌─────────────────────────────────────────┐
                     │             Supabase DB (shared)         │
                     │                                          │
                     │  ┌─────────────────┐                    │
  Usuarios A ────────┼──│  Organismo A    │── tareas_A         │
                     │  │  (plan Pro)     │── responsables_A   │
                     │  └─────────────────┘                    │
                     │                                          │
                     │  ┌─────────────────┐                    │
  Usuarios B ────────┼──│  Organismo B    │── tareas_B         │
                     │  │  (plan Básico)  │── responsables_B   │
                     │  └─────────────────┘                    │
                     │                                          │
                     │  ┌─────────────────┐                    │
  Usuarios C,D ──────┼──│  Organismo C    │── tareas_C         │
                     │  │  (plan Empresa) │── responsables_C   │
                     │  └─────────────────┘                    │
                     └─────────────────────────────────────────┘
```

### Por qué este modelo y no otro

Dropbox utiliza un modelo de **shared database, shared schema** con aislamiento a nivel de Row Level Security. Elegimos el mismo enfoque porque:

- Evita la complejidad operativa de múltiples bases de datos.
- Las políticas RLS de Supabase hacen el aislamiento de forma nativa y auditable.
- Una sola instancia de la aplicación sirve a todos los organismos.
- Los costes de infraestructura escalan linealmente con los datos, no con el número de organismos.

---

## 2. Principios de diseño

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. AISLAMIENTO POR DEFECTO                                     │
│     Ninguna query devuelve datos fuera del organismo activo.    │
│     El filtro no es opcional; es estructural.                   │
│                                                                 │
│  2. CERO CAMBIOS EN LA LÓGICA DE NEGOCIO                        │
│     Los 4 roles, el semáforo, la agenda y las alertas operan    │
│     exactamente igual. Solo cambia el scope de los datos.       │
│                                                                 │
│  3. UN USUARIO, MÚLTIPLES ORGANISMOS                            │
│     Un usuario puede pertenecer a varios organismos con         │
│     roles distintos en cada uno. La sesión recuerda cuál        │
│     está activo.                                                │
│                                                                 │
│  4. PAGO PRIMERO, DATOS DESPUÉS                                 │
│     Un organismo no puede insertar datos de producción          │
│     sin una suscripción activa o un periodo de prueba.          │
│                                                                 │
│  5. MIGRACIÓN SIN ROTURAS                                       │
│     Los datos de Segesa (organismo semilla) se migran           │
│     automáticamente. Los usuarios existentes no perciben        │
│     ningún cambio en su flujo de trabajo.                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Arquitectura de alto nivel

### Vista de capas

```
 ┌──────────────────────────────────────────────────────────────────┐
 │  CLIENTE (Browser)                                               │
 │                                                                  │
 │  Next.js App Router                                              │
 │  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
 │  │  /planes   │  │ /organismos  │  │  /organismos/[slug]/...  │ │
 │  │  (pública) │  │  /nuevo      │  │  agenda · dashboard      │ │
 │  └────────────┘  └──────────────┘  │  alertas · estadísticas  │ │
 │                                    │  miembros · facturación  │ │
 │                                    └──────────────────────────┘ │
 └──────────────────────────┬───────────────────────────────────────┘
                            │
 ┌──────────────────────────▼───────────────────────────────────────┐
 │  MIDDLEWARE (Edge)                                               │
 │                                                                  │
 │  1. Verificar sesión Supabase Auth                               │
 │  2. Resolver organismo activo  ──► cookie organismo_activo_id   │
 │  3. Verificar membresía activa en ese organismo                  │
 │  4. Verificar suscripción activa  ──► si no, → /facturación     │
 │  5. Inyectar x-organismo-id en headers de la request            │
 └──────────────────────────┬───────────────────────────────────────┘
                            │
 ┌──────────────────────────▼───────────────────────────────────────┐
 │  API ROUTES (Next.js Server)                                     │
 │                                                                  │
 │  /api/tareas         /api/alertas       /api/dashboard           │
 │  /api/responsables   /api/historial     /api/estadisticas        │
 │  /api/catalogos      /api/organismos    /api/billing/*           │
 │                                                                  │
 │  Todas las queries llevan .eq('organismo_id', organismoId)       │
 └──────────────────────────┬───────────────────────────────────────┘
                            │
 ┌──────────────────────────▼───────────────────────────────────────┐
 │  SUPABASE                                                        │
 │                                                                  │
 │  PostgreSQL + RLS  ◄── segunda barrera de aislamiento            │
 │  Auth (JWT)                                                      │
 │  Storage (logos, adjuntos)                                       │
 └──────────────────────────┬───────────────────────────────────────┘
                            │
 ┌──────────────────────────▼───────────────────────────────────────┐
 │  SERVICIOS EXTERNOS                                              │
 │                                                                  │
 │  Stripe Billing  ──► suscripciones · checkout · portal · webhook │
 │  Resend          ──► invitaciones · notificaciones de tarea      │
 └──────────────────────────────────────────────────────────────────┘
```

### Resolución del organismo activo

```
Request entrante
      │
      ▼
¿Cookie organismo_activo_id?
      │
      ├── SÍ ──► ¿usuario es miembro activo? ──► SÍ ──► usar ese organismo
      │                                       │
      │                                       └── NO ──► limpiar cookie
      │
      └── NO ──► ¿cuántos organismos tiene el usuario?
                      │
                      ├── 1 ──► establecer ese como activo
                      │
                      ├── >1 ──► redirigir a /seleccionar-organismo
                      │
                      └── 0 ──► redirigir a /organismos/nuevo
```

---

## 4. Modelo de datos

### Diagrama entidad-relación

```
 auth.users (Supabase)
      │
      │ 1
      ▼ N
 perfiles ──────────────────────────────────────────────────────┐
      │                                                          │
      │ N                                                        │
      ▼                                                          │
 organismo_miembros ──── N ──► organismos ◄── 1 ── organismo_suscripciones
      │                              │                    │
      │                              │                    │
      │                              │ 1                  │ N
      │                              ▼ N                  ▼
      │                         ┌──────────────────┐  organismo_facturas
      │                         │  tareas          │
      │                         │  responsables    │
      │                         │  departamentos   │
      │                         │  historial       │
      │                         │  alertas         │
      │                         └──────────────────┘
      │
      └── asignado_por / invitado_por (FK circular, nullable)
```

### Tablas nuevas

#### `organismos`

```sql
CREATE TABLE organismos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  -- 'individual': 1 usuario, límites reducidos, sin invitaciones
  -- 'corporativo': múltiples usuarios, límites según plan
  tipo        TEXT NOT NULL DEFAULT 'corporativo'
                CHECK (tipo IN ('individual', 'corporativo')),
  logo_url    TEXT,
  website     TEXT,
  sector      TEXT,
  pais        TEXT DEFAULT 'ES',
  activo      BOOLEAN DEFAULT true,
  creado_por  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `organismo_miembros`

```sql
-- Cada fila es un contrato: "este usuario tiene este rol en este organismo".
-- Un usuario puede tener filas en varios organismos con roles distintos.
CREATE TABLE organismo_miembros (
  id            BIGSERIAL PRIMARY KEY,
  organismo_id  UUID NOT NULL REFERENCES organismos(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol_codigo    TEXT NOT NULL DEFAULT 'responsable'
                  CHECK (rol_codigo IN ('administrador', 'supervisor', 'responsable', 'consulta')),
  activo        BOOLEAN DEFAULT true,
  invitado_por  UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organismo_id, usuario_id)
);
```

#### `organismo_suscripciones`

```sql
CREATE TABLE organismo_suscripciones (
  id                      BIGSERIAL PRIMARY KEY,
  organismo_id            UUID NOT NULL REFERENCES organismos(id) ON DELETE CASCADE,
  plan_codigo             TEXT NOT NULL
                            CHECK (plan_codigo IN ('individual', 'basico', 'pro', 'empresa')),
  estado                  TEXT NOT NULL DEFAULT 'prueba'
                            CHECK (estado IN ('activa', 'pausada', 'cancelada', 'prueba')),
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  periodo_inicio          TIMESTAMPTZ,
  periodo_fin             TIMESTAMPTZ,
  trial_fin               TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

#### `organismo_facturas`

```sql
CREATE TABLE organismo_facturas (
  id                  BIGSERIAL PRIMARY KEY,
  organismo_id        UUID NOT NULL REFERENCES organismos(id),
  stripe_invoice_id   TEXT UNIQUE,
  importe_centimos    INTEGER NOT NULL,
  moneda              TEXT DEFAULT 'eur',
  estado              TEXT CHECK (estado IN ('pagada', 'pendiente', 'fallida', 'anulada')),
  pdf_url             TEXT,
  fecha_emision       TIMESTAMPTZ,
  fecha_vencimiento   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

#### `organismo_invitaciones`

```sql
-- Token de un solo uso para invitar a nuevos miembros.
CREATE TABLE organismo_invitaciones (
  id            BIGSERIAL PRIMARY KEY,
  organismo_id  UUID NOT NULL REFERENCES organismos(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  rol_codigo    TEXT NOT NULL DEFAULT 'responsable',
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  usado         BOOLEAN DEFAULT false,
  expira_at     TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
  invitado_por  UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Columna `organismo_id` en tablas existentes

```sql
ALTER TABLE tareas          ADD COLUMN organismo_id UUID REFERENCES organismos(id);
ALTER TABLE responsables    ADD COLUMN organismo_id UUID REFERENCES organismos(id);
ALTER TABLE departamentos   ADD COLUMN organismo_id UUID REFERENCES organismos(id);
ALTER TABLE historial       ADD COLUMN organismo_id UUID REFERENCES organismos(id);
ALTER TABLE alertas         ADD COLUMN organismo_id UUID REFERENCES organismos(id);

-- Índices. Sin estos, cada query de tenant escanea la tabla completa.
CREATE INDEX idx_tareas_org        ON tareas(organismo_id);
CREATE INDEX idx_responsables_org  ON responsables(organismo_id);
CREATE INDEX idx_departamentos_org ON departamentos(organismo_id);
CREATE INDEX idx_historial_org     ON historial(organismo_id);
CREATE INDEX idx_alertas_org       ON alertas(organismo_id);
```

---

## 5. Sistema de roles por organismo

Los 4 roles actuales no cambian en su definición de permisos. Lo que cambia es que **el rol es una propiedad del organismo, no del usuario**. El mismo usuario puede ser `administrador` en el Organismo A y `responsable` en el Organismo B.

```
 Usuario: Carlos García
 ┌────────────────────────────────────────────────────────┐
 │  Organismo A (Segesa)      → rol: administrador        │
 │  Organismo B (Filial Sur)  → rol: supervisor           │
 │  Organismo C (Cliente X)   → rol: consulta             │
 └────────────────────────────────────────────────────────┘
```

### Matriz de permisos (sin cambios respecto al sistema actual)

```
                          │ admin │ supervisor │ responsable │ consulta │
──────────────────────────┼───────┼────────────┼─────────────┼──────────┤
Ver todas las tareas      │   ✓   │     ✓      │  solo asig. │    ✓     │
Crear tareas              │   ✓   │     ✓      │      –      │    –     │
Editar tareas             │   ✓   │     ✓      │  solo asig. │    –     │
Eliminar tareas           │   ✓   │     –      │      –      │    –     │
Ver estadísticas          │   ✓   │     ✓      │      –      │    –     │
Gestionar miembros        │   ✓   │     –      │      –      │    –     │
Gestionar suscripción     │   ✓   │     –      │      –      │    –     │
Invitar usuarios          │   ✓   │     ✓      │      –      │    –     │
──────────────────────────┴───────┴────────────┴─────────────┴──────────┘
```

### Resolución del rol en el middleware

```typescript
// lib/organismo-access.ts
export async function resolverRolActivo(
  supabase: SupabaseClient,
  usuarioId: string,
  organismoId: string
): Promise<RolCodigo | null> {
  const { data } = await supabase
    .from('organismo_miembros')
    .select('rol_codigo')
    .eq('usuario_id', usuarioId)
    .eq('organismo_id', organismoId)
    .eq('activo', true)
    .single()

  return (data?.rol_codigo as RolCodigo) ?? null
}
```

---

## 6. Tipos de cuenta y planes

### Cuenta Individual

```
┌─────────────────────────────────────────────────────────┐
│  INDIVIDUAL                                             │
│                                                         │
│  • 1 usuario (propietario = administrador)              │
│  • Máx. 50 tareas activas                               │
│  • Historial: 90 días                                   │
│  • Sin invitaciones a otros miembros                    │
│  • Sin alertas por correo                               │
│  • Precio: Gratis                                       │
└─────────────────────────────────────────────────────────┘
```

### Cuenta Corporativa

```
┌───────────────────┬───────────────────┬────────────────────────┐
│     BÁSICO        │       PRO         │       EMPRESA          │
├───────────────────┼───────────────────┼────────────────────────┤
│  9 €/mes          │  29 €/mes         │  79 €/mes              │
│  90 €/año         │  290 €/año        │  790 €/año             │
├───────────────────┼───────────────────┼────────────────────────┤
│  Hasta 5 usuarios │  Hasta 25 usuarios│  Ilimitados            │
│  200 tareas       │  1.000 tareas     │  Ilimitadas            │
│  Historial 1 año  │  Historial 2 años │  Historial ilimitado   │
│  Alertas correo ✓ │  Alertas correo ✓ │  Alertas correo ✓      │
│  Exportar datos – │  Exportar datos ✓ │  Exportar datos ✓      │
│  API externa –    │  API externa –    │  API externa ✓         │
│  Soporte email    │  Soporte priorit. │  Soporte dedicado      │
└───────────────────┴───────────────────┴────────────────────────┘
```

### Validación de límites de plan

Los límites se comprueban en el servidor antes de insertar datos, no solo en la UI.

```typescript
// lib/plan-limits.ts
export async function verificarLimiteTareas(
  supabase: SupabaseClient,
  organismoId: string
): Promise<{ permitido: boolean; motivo?: string }> {
  const [{ count }, suscripcion] = await Promise.all([
    supabase.from('tareas').select('*', { count: 'exact', head: true })
      .eq('organismo_id', organismoId)
      .neq('estado', 'Cancelado'),
    obtenerSuscripcion(organismoId)
  ])

  const limite = LIMITES_POR_PLAN[suscripcion.plan_codigo].tareas
  if (limite !== Infinity && (count ?? 0) >= limite) {
    return { permitido: false, motivo: `El plan ${suscripcion.plan_codigo} admite máximo ${limite} tareas activas.` }
  }
  return { permitido: true }
}
```

---

## 7. Pipeline de pagos

### Componentes

```
 ┌──────────────────────────────────────────────────────────────────┐
 │  STRIPE BILLING PIPELINE                                         │
 │                                                                  │
 │  app/planes             → Página pública de precios             │
 │  (pública)                                                       │
 │       │                                                          │
 │       │ usuario elige plan                                       │
 │       ▼                                                          │
 │  POST /api/billing/checkout                                      │
 │       │                                                          │
 │       │ devuelve Stripe Checkout Session URL                     │
 │       ▼                                                          │
 │  stripe.com/checkout (hosted)                                    │
 │       │                                                          │
 │       ├── éxito → redirect a /organismos/[slug]/dashboard        │
 │       │                                                          │
 │       └── cancelar → redirect a /planes                         │
 │                                                                  │
 │  POST /api/billing/webhook   ◄── Stripe envía eventos aquí      │
 │       │                                                          │
 │       ├── checkout.session.completed  → activar suscripción      │
 │       ├── invoice.paid                → registrar factura        │
 │       ├── invoice.payment_failed      → pausar + notificar       │
 │       ├── subscription.deleted        → cancelar                 │
 │       └── subscription.updated        → actualizar plan          │
 │                                                                  │
 │  POST /api/billing/portal                                        │
 │       │                                                          │
 │       └── devuelve Stripe Customer Portal URL                    │
 │           (gestión de tarjeta, facturas, cancelar)               │
 └──────────────────────────────────────────────────────────────────┘
```

### Variables de entorno necesarias

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# IDs de precio de Stripe (crear en el dashboard de Stripe)
STRIPE_PRICE_BASICO_MENSUAL=price_...
STRIPE_PRICE_BASICO_ANUAL=price_...
STRIPE_PRICE_PRO_MENSUAL=price_...
STRIPE_PRICE_PRO_ANUAL=price_...
STRIPE_PRICE_EMPRESA_MENSUAL=price_...
STRIPE_PRICE_EMPRESA_ANUAL=price_...
```

> **Importante:** ninguna variable de Stripe lleva el prefijo `NEXT_PUBLIC_`. La clave secreta nunca llega al cliente.

### Nuevos archivos

```
lib/
  stripe.ts                  ← cliente Stripe singleton (server-only)
  plan-limits.ts             ← validación de límites por plan
  billing/
    plans.ts                 ← definición de planes, precios y límites
    checkout.ts              ← crear Stripe Checkout Session
    portal.ts                ← abrir Stripe Customer Portal
    webhooks.ts              ← handleWebhookEvent()

app/api/billing/
  checkout/route.ts          ← POST
  portal/route.ts            ← POST
  webhook/route.ts           ← POST (sin autenticación de sesión, firma Stripe)

app/
  planes/page.tsx            ← página pública de precios
  organismos/
    nuevo/page.tsx
    [slug]/
      facturacion/page.tsx
```

---

## 8. Aislamiento y seguridad de datos

### Dos barreras de aislamiento

```
 Request de Usuario A (Organismo A)
           │
           ▼
 ┌─────────────────────────────────────┐
 │  BARRERA 1: Middleware + API        │
 │                                     │
 │  organismoId = resolverOrganismo()  │
 │  query.eq('organismo_id', id)       │
 └──────────────────┬──────────────────┘
                    │
                    ▼
 ┌─────────────────────────────────────┐
 │  BARRERA 2: Supabase RLS            │
 │                                     │
 │  POLICY: solo filas donde           │
 │  organismo_id IN (mis organismos)   │
 └──────────────────┬──────────────────┘
                    │
                    ▼
             Datos de Organismo A
             (Organismo B invisible)
```

### Políticas RLS

```sql
-- Habilitar RLS en todas las tablas de datos
ALTER TABLE tareas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsables    ENABLE ROW LEVEL SECURITY;
ALTER TABLE departamentos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial       ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas         ENABLE ROW LEVEL SECURITY;

-- Política reutilizable (mismo patrón para todas las tablas)
CREATE POLICY "aislamiento_por_organismo" ON tareas
  FOR ALL USING (
    organismo_id IN (
      SELECT organismo_id FROM organismo_miembros
      WHERE usuario_id = auth.uid() AND activo = true
    )
  );

-- Miembros: solo el propio organismo puede ver su lista de miembros
CREATE POLICY "miembros_visibles_en_organismo" ON organismo_miembros
  FOR SELECT USING (
    organismo_id IN (
      SELECT organismo_id FROM organismo_miembros m2
      WHERE m2.usuario_id = auth.uid() AND m2.activo = true
    )
  );

-- Solo administradores del organismo pueden insertar/actualizar miembros
CREATE POLICY "solo_admin_gestiona_miembros" ON organismo_miembros
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organismo_miembros
      WHERE usuario_id = auth.uid()
        AND organismo_id = organismo_miembros.organismo_id
        AND rol_codigo = 'administrador'
        AND activo = true
    )
  );
```

### Seguridad del webhook de Stripe

```typescript
// app/api/billing/webhook/route.ts
export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    // Verificar firma criptográfica antes de procesar nada
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  await handleWebhookEvent(event)
  return NextResponse.json({ received: true })
}
```

---

## 9. Cambios en la capa de aplicación

### Nuevas rutas

```
app/
  planes/                           ← pública, sin auth
  seleccionar-organismo/            ← para usuarios con múltiples organismos
  organismos/
    nuevo/                          ← crear organismo (datos + pago)
    [slug]/
      page.tsx → redirige a agenda
      agenda/                       ← ex app/page.tsx
      dashboard/                    ← ex app/dashboard/
      alertas/                      ← ex app/alertas/
      cronograma/                   ← ex app/cronograma/
      estadisticas/                 ← ex app/estadisticas/
      busqueda/                     ← ex app/busqueda/
      historial/                    ← ex app/historial/
      responsable/                  ← ex app/responsable/
      catalogos/                    ← ex app/catalogos/
      miembros/                     ← NUEVO: gestión de miembros
      ajustes/                      ← NUEVO: configuración del organismo
      facturacion/                  ← NUEVO: plan, pago, facturas
```

### Cambios mínimos en componentes existentes

```
Sidebar.tsx
  + Logo e identificador del organismo activo en la cabecera
  + Enlace a /miembros (visible solo para admin/supervisor)
  + Enlace a /facturacion (visible solo para admin)
  + Componente OrganismoSelector (dropdown si tiene múltiples)

UserSessionProvider.tsx
  + organismoActivo: Organismo | null
  + miOrganismos: OrganismoMiembro[]
  + rolEnOrganismo: RolCodigo | null    ← sustituye al rol global actual

middleware.ts
  + pasos 2-5 descritos en la sección 3
```

### Nuevos componentes

```
components/
  OrganismoSelector.tsx       ← dropdown para cambiar de organismo activo
  MiembrosTable.tsx           ← tabla de miembros con rol y estado
  InvitarMiembroModal.tsx     ← formulario de invitación por email
  PlanBadge.tsx               ← badge del plan activo del organismo
  BillingCard.tsx             ← resumen de suscripción en /facturacion
```

---

## 10. Flujos críticos

### Alta de organismo con pago

```
 1. Usuario autenticado visita /organismos/nuevo
         │
         ▼
 2. Rellena: nombre, tipo (individual/corporativo), sector, país
         │
         ▼
 3. Elige plan + intervalo (mensual/anual)
         │
         ├── Plan Individual (gratis)
         │         │
         │         ▼
         │   POST /api/organismos
         │   → crea organismo
         │   → crea miembro (rol: administrador)
         │   → crea suscripción (estado: activa, plan: individual)
         │   → redirect a /organismos/[slug]/agenda
         │
         └── Plan de pago
                   │
                   ▼
             POST /api/billing/checkout
             → crea organismo (pendiente de activación)
             → crea suscripción (estado: prueba)
             → devuelve Stripe Checkout URL
                   │
                   ▼
             Usuario paga en Stripe
                   │
                   ▼
             Webhook: checkout.session.completed
             → actualiza suscripción (estado: activa)
             → redirect a /organismos/[slug]/agenda
```

### Invitación de miembro

```
 Admin visita /organismos/[slug]/miembros
         │
         ▼
 Introduce email + elige rol
         │
         ▼
 POST /api/organismos/[slug]/invitaciones
 → verifica límite de usuarios del plan
 → crea fila en organismo_invitaciones (token, expira en 48h)
 → envía email con enlace firmado (Resend)
         │
         ▼
 Destinatario hace clic en el enlace
         │
         ├── ¿tiene cuenta?
         │     ├── SÍ → POST /api/organismos/aceptar-invitacion?token=...
         │     │         → crea organismo_miembros
         │     │         → marca invitación como usada
         │     │         → redirect al organismo
         │     │
         │     └── NO → redirect a /registro?invitacion=...
         │               → tras registrarse, acepta automáticamente
         │
         └── ¿token expirado o ya usado?
               → mensaje de error + enlace para pedir nueva invitación
```

---

## 11. Migración sin downtime

El objetivo es que los usuarios de Segesa no perciban ningún cambio.

```
FASE A — Preparar esquema (sin tocar datos existentes)
──────────────────────────────────────────────────────
  1. Crear las 5 tablas nuevas (organismos, miembros, suscripciones, etc.)
  2. Añadir columna organismo_id NULLABLE a tareas, responsables, etc.
  3. Crear índices en organismo_id
  4. NO activar RLS todavía

FASE B — Migrar datos de Segesa
──────────────────────────────────────────────────────
  1. Crear el organismo semilla "Segesa" con UUID fijo
  2. Asignar todos los perfiles existentes como miembros (con su rol actual)
  3. Actualizar todas las filas con organismo_id = UUID_SEGESA
  4. Establecer NOT NULL en organismo_id
  5. Crear suscripción "empresa" activa para Segesa

FASE C — Activar aislamiento
──────────────────────────────────────────────────────
  1. Activar RLS en todas las tablas migradas
  2. Desplegar nueva versión de la app (middleware + context)
  3. Verificar que los usuarios de Segesa siguen viendo sus datos

FASE D — Abrir registro multi-organismo
──────────────────────────────────────────────────────
  1. Publicar /planes
  2. Activar /organismos/nuevo
  3. Configurar Stripe en modo live
```

### Script SQL de migración

```sql
-- FASE B completa

BEGIN;

-- 1. Organismo semilla
INSERT INTO organismos (id, nombre, slug, tipo, activo, creado_por)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Segesa',
  'segesa',
  'corporativo',
  true,
  (SELECT id FROM auth.users LIMIT 1)  -- primer usuario como propietario
);

-- 2. Migrar todos los perfiles como miembros
INSERT INTO organismo_miembros (organismo_id, usuario_id, rol_codigo)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  COALESCE(tu.codigo, 'responsable')
FROM perfiles p
LEFT JOIN tipos_usuario tu ON tu.id = p.tipo_usuario_id
ON CONFLICT (organismo_id, usuario_id) DO NOTHING;

-- 3. Asignar organismo_id a todas las filas existentes
UPDATE tareas          SET organismo_id = '00000000-0000-0000-0000-000000000001';
UPDATE responsables    SET organismo_id = '00000000-0000-0000-0000-000000000001';
UPDATE departamentos   SET organismo_id = '00000000-0000-0000-0000-000000000001';
UPDATE historial       SET organismo_id = '00000000-0000-0000-0000-000000000001';
UPDATE alertas         SET organismo_id = '00000000-0000-0000-0000-000000000001';

-- 4. Hacer NOT NULL
ALTER TABLE tareas          ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE responsables    ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE departamentos   ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE historial       ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE alertas         ALTER COLUMN organismo_id SET NOT NULL;

-- 5. Suscripción activa para Segesa
INSERT INTO organismo_suscripciones (organismo_id, plan_codigo, estado)
VALUES ('00000000-0000-0000-0000-000000000001', 'empresa', 'activa');

COMMIT;
```

---

## 12. Roadmap de implementación

```
 FASE 1 ──── Semanas 1-2: Esquema y migración de datos
 ┌──────────────────────────────────────────────────────────────┐
 │  [ ] Tablas nuevas: organismos, miembros, suscripciones      │
 │  [ ] Columna organismo_id + índices en tablas existentes     │
 │  [ ] Script de migración de Segesa                           │
 │  [ ] Políticas RLS (activar tras migración)                  │
 │  [ ] Actualizar lib/types.ts con nuevas interfaces           │
 └──────────────────────────────────────────────────────────────┘

 FASE 2 ──── Semanas 3-4: Aislamiento en la app
 ┌──────────────────────────────────────────────────────────────┐
 │  [ ] lib/organismo-access.ts                                 │
 │  [ ] Middleware ampliado (resolver organismo + suscripción)  │
 │  [ ] .eq('organismo_id') en todos los route handlers         │
 │  [ ] UserSessionProvider con contexto de organismo           │
 │  [ ] Sidebar: logo organismo + OrganismoSelector             │
 └──────────────────────────────────────────────────────────────┘

 FASE 3 ──── Semanas 5-6: Alta y gestión de organismos
 ┌──────────────────────────────────────────────────────────────┐
 │  [ ] Página /organismos/nuevo                                │
 │  [ ] POST /api/organismos                                    │
 │  [ ] Página /organismos/[slug]/miembros                      │
 │  [ ] Sistema de invitaciones (BD + email + aceptación)       │
 │  [ ] Página /organismos/[slug]/ajustes                       │
 └──────────────────────────────────────────────────────────────┘

 FASE 4 ──── Semanas 7-8: Planes y pagos
 ┌──────────────────────────────────────────────────────────────┐
 │  [ ] lib/stripe.ts + lib/billing/*                           │
 │  [ ] Productos y precios en Stripe dashboard                 │
 │  [ ] /api/billing/checkout, portal, webhook                  │
 │  [ ] Página /planes (pública)                                │
 │  [ ] Página /organismos/[slug]/facturacion                   │
 │  [ ] Validación de límites de plan en APIs                   │
 │  [ ] Gate de suscripción en middleware                       │
 └──────────────────────────────────────────────────────────────┘

 FASE 5 ──── Semana 9: Producción
 ┌──────────────────────────────────────────────────────────────┐
 │  [ ] Tests del flujo de pago en modo Stripe test             │
 │  [ ] Mensajes de UI cuando se alcanza el límite del plan     │
 │  [ ] Email de bienvenida al crear organismo                  │
 │  [ ] Logging de webhooks fallidos                            │
 │  [ ] Activar Stripe en modo live                             │
 └──────────────────────────────────────────────────────────────┘
```

---

## 13. Trade-offs y decisiones abiertas

### Decisiones tomadas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Shared DB + RLS | Una DB por organismo | Coste operativo insostenible con muchos organismos pequeños |
| Stripe Billing hosted | Implementación propia del pago | Stripe gestiona PCI DSS, reintentos, facturas y portal |
| Slug en URL `/organismos/[slug]` | Solo UUID | El slug es legible y compartible; el UUID va en headers internos |
| Cookie para organismo activo | Solo en JWT | El JWT no se puede modificar sin re-login; la cookie es mutable |
| 14 días de prueba gratis | No trial | Reduce la fricción para organismos nuevos |

### Decisiones abiertas

```
┌──────────────────────────────────────────────────────────────────┐
│  1. ¿Permitir que un organismo tenga múltiples admins?           │
│     Sí: más flexibilidad. Riesgo: conflictos de configuración.   │
│                                                                  │
│  2. ¿Subdominios por organismo?                                  │
│     (segesa.agendaapp.com vs agendaapp.com/organismos/segesa)    │
│     Subdominios requieren wildcard SSL y DNS dinámico.           │
│                                                                  │
│  3. ¿Exportación de datos al cancelar?                           │
│     GDPR recomienda ofrecer export antes de borrar datos.        │
│     Añadir endpoint /api/organismos/[slug]/export.               │
│                                                                  │
│  4. ¿Retención de datos tras cancelación?                        │
│     Sugerido: 30 días con datos inactivos, luego borrado.        │
│     Requiere job de limpieza programado.                         │
│                                                                  │
│  5. ¿Plan Enterprise con precio negociado?                       │
│     Flujo de contacto manual en lugar de Stripe checkout.        │
└──────────────────────────────────────────────────────────────────┘
```

---

### Dependencias nuevas

```bash
npm install stripe               # Servidor: Stripe Node SDK
npm install @stripe/stripe-js    # Cliente: Stripe.js para redirect al checkout
```

---

*Este documento debe revisarse antes del inicio de cada fase.*
*Las decisiones abiertas deben resolverse antes de comenzar la Fase 3.*
