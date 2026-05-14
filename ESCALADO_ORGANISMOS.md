# Plan de escalado: Organismos Funcionales

> Documento de arquitectura para transformar Agenda App en una plataforma multi-organismo con facturación integrada.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Qué cambia del proyecto actual](#2-qué-cambia-del-proyecto-actual)
3. [Modelo de datos: nuevas tablas](#3-modelo-de-datos-nuevas-tablas)
4. [Roles por organismo](#4-roles-por-organismo)
5. [Tipos de cuenta: individual vs. corporativa](#5-tipos-de-cuenta-individual-vs-corporativa)
6. [Sistema de planes y pagos](#6-sistema-de-planes-y-pagos)
7. [Aislamiento de datos entre organismos](#7-aislamiento-de-datos-entre-organismos)
8. [Cambios en la aplicación existente](#8-cambios-en-la-aplicación-existente)
9. [Flujo completo de alta de organismo](#9-flujo-completo-de-alta-de-organismo)
10. [Migración desde el estado actual](#10-migración-desde-el-estado-actual)
11. [Roadmap de implementación](#11-roadmap-de-implementación)

---

## 1. Visión general

La aplicación actual opera como un sistema de agenda **monorganismo**: una sola instancia de tareas, responsables y departamentos compartida por todos los usuarios. El objetivo es convertirla en una plataforma donde cada **Organismo** (empresa, institución o equipo) tenga su propio espacio aislado, con sus propios usuarios, roles, tareas y configuración, pagando una suscripción según el plan contratado.

```
ANTES (monorganismo)
─────────────────────────────────────
  Supabase DB  →  1 conjunto de tareas  →  Todos los usuarios

DESPUÉS (multi-organismo)
─────────────────────────────────────
  Supabase DB
    ├── Organismo A (plan Básico)   →  usuarios A  →  tareas A
    ├── Organismo B (plan Pro)      →  usuarios B  →  tareas B
    └── Organismo C (plan Empresa)  →  usuarios C  →  tareas C
```

---

## 2. Qué cambia del proyecto actual

| Área | Situación actual | Con organismos |
|---|---|---|
| `tareas` | Sin `organismo_id` | Cada fila lleva `organismo_id` |
| `responsables` | Catálogo global | Catálogo por organismo |
| `departamentos` | Catálogo global | Catálogo por organismo |
| `historial` | Historial global | Historial por organismo |
| `alertas` | Alertas globales | Alertas por organismo |
| Roles (`tipo_usuario`) | 4 roles fijos globales | 4 roles asignados por organismo |
| Registro de usuario | Crea perfil global | Crea perfil + lo vincula a un organismo |
| Auth middleware | Comprueba rol global | Comprueba rol dentro del organismo activo |

---

## 3. Modelo de datos: nuevas tablas

### 3.1 `organismos`

```sql
CREATE TABLE organismos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,           -- identificador URL-safe
  tipo          TEXT NOT NULL DEFAULT 'corporativo'
                  CHECK (tipo IN ('individual', 'corporativo')),
  logo_url      TEXT,
  website       TEXT,
  sector        TEXT,                           -- sector de actividad
  pais          TEXT DEFAULT 'ES',
  activo        BOOLEAN DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 `organismo_miembros`

Vincula usuarios a organismos con un rol específico dentro de ese organismo.

```sql
CREATE TABLE organismo_miembros (
  id              BIGSERIAL PRIMARY KEY,
  organismo_id    UUID NOT NULL REFERENCES organismos(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol_codigo      TEXT NOT NULL DEFAULT 'responsable'
                    CHECK (rol_codigo IN ('administrador', 'supervisor', 'responsable', 'consulta')),
  activo          BOOLEAN DEFAULT true,
  invitado_por    UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organismo_id, usuario_id)
);
```

### 3.3 `organismo_suscripciones`

```sql
CREATE TABLE organismo_suscripciones (
  id                    BIGSERIAL PRIMARY KEY,
  organismo_id          UUID NOT NULL REFERENCES organismos(id) ON DELETE CASCADE,
  plan_codigo           TEXT NOT NULL CHECK (plan_codigo IN ('basico', 'pro', 'empresa')),
  estado                TEXT NOT NULL DEFAULT 'activa'
                          CHECK (estado IN ('activa', 'pausada', 'cancelada', 'prueba')),
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  periodo_inicio        TIMESTAMPTZ,
  periodo_fin           TIMESTAMPTZ,
  trial_fin             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.4 `organismo_facturas`

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

### 3.5 Columna `organismo_id` en tablas existentes

```sql
-- Añadir a cada tabla que contiene datos del organismo
ALTER TABLE tareas          ADD COLUMN organismo_id UUID REFERENCES organismos(id);
ALTER TABLE responsables    ADD COLUMN organismo_id UUID REFERENCES organismos(id);
ALTER TABLE departamentos   ADD COLUMN organismo_id UUID REFERENCES organismos(id);
ALTER TABLE historial       ADD COLUMN organismo_id UUID REFERENCES organismos(id);
ALTER TABLE alertas         ADD COLUMN organismo_id UUID REFERENCES organismos(id);

-- Índices para rendimiento
CREATE INDEX idx_tareas_organismo          ON tareas(organismo_id);
CREATE INDEX idx_responsables_organismo    ON responsables(organismo_id);
CREATE INDEX idx_departamentos_organismo   ON departamentos(organismo_id);
CREATE INDEX idx_historial_organismo       ON historial(organismo_id);
CREATE INDEX idx_alertas_organismo         ON alertas(organismo_id);
```

---

## 4. Roles por organismo

Los 4 roles actuales (`administrador/a`, `supervisor`, `responsable`, `consulta`) se mantienen exactamente igual en su lógica de permisos, pero ahora son **por organismo**, no globales.

```
Organismo A                    Organismo B
───────────────────────        ───────────────────────
  Usuario X → administrador      Usuario X → responsable
  Usuario Y → supervisor         Usuario Z → consulta
  Usuario Z → responsable
```

### Permisos por rol (sin cambios)

| Capacidad | administrador | supervisor | responsable | consulta |
|---|:---:|:---:|:---:|:---:|
| Ver todas las tareas del organismo | ✓ | ✓ | Solo asignadas | ✓ |
| Crear tareas | ✓ | ✓ | — | — |
| Editar tareas | ✓ | ✓ | Solo asignadas | — |
| Eliminar tareas | ✓ | — | — | — |
| Gestionar miembros del organismo | ✓ | — | — | — |
| Ver estadísticas completas | ✓ | ✓ | — | — |
| Gestionar suscripción | ✓ | — | — | — |
| Invitar nuevos usuarios | ✓ | ✓ | — | — |

### Resolución del rol activo en middleware

```typescript
// lib/organismo-access.ts  (nuevo archivo)
export async function getOrganismoActivo(
  supabase: SupabaseClient,
  usuarioId: string
): Promise<{ organismoId: string; rolCodigo: string } | null> {
  // 1. Leer organismo_id de la cookie de sesión del organismo
  // 2. Verificar que el usuario es miembro activo
  // 3. Devolver organismo + rol resuelto
}
```

---

## 5. Tipos de cuenta: individual vs. corporativa

### Cuenta individual

- Un solo usuario es propietario y único miembro del organismo.
- Límite: **1 usuario, hasta 50 tareas activas**.
- Caso de uso: freelance, uso personal.
- El campo `organismos.tipo = 'individual'`.
- No puede invitar otros miembros (UI desactiva la sección de miembros).

### Cuenta corporativa

- Un administrador crea el organismo e invita miembros.
- Límites según el plan contratado (ver sección 6).
- Puede tener múltiples administradores.
- El campo `organismos.tipo = 'corporativo'`.

### Comparativa

| | Individual | Corporativa Básica | Corporativa Pro | Corporativa Empresa |
|---|---|---|---|---|
| Usuarios | 1 | Hasta 5 | Hasta 25 | Ilimitados |
| Tareas activas | 50 | 200 | 1 000 | Ilimitadas |
| Historial | 90 días | 1 año | 2 años | Ilimitado |
| Alertas por correo | — | ✓ | ✓ | ✓ |
| Exportar datos | — | — | ✓ | ✓ |
| API externa | — | — | — | ✓ |
| Soporte | — | Email | Prioritario | Dedicado |

---

## 6. Sistema de planes y pagos

### 6.1 Planes y precios (referencia inicial)

```
INDIVIDUAL   →  Gratis (con límites)
BÁSICO       →  9 €/mes  o  90 €/año
PRO          →  29 €/mes o 290 €/año
EMPRESA      →  79 €/mes o 790 €/año  (o precio negociado)
```

### 6.2 Integración con Stripe

La integración recomendada es **Stripe Billing** con webhooks para mantener el estado de suscripción en `organismo_suscripciones`.

**Nuevos archivos a crear:**

```
lib/
  stripe.ts                  # cliente Stripe singleton
  billing/
    plans.ts                 # definición de planes y precios
    checkout.ts              # crear sesión de pago
    portal.ts                # portal de cliente Stripe
    webhooks.ts              # manejador de eventos Stripe

app/api/
  billing/
    checkout/route.ts        # POST → crear Stripe Checkout Session
    portal/route.ts          # POST → abrir portal de cliente
    webhook/route.ts         # POST → recibir eventos de Stripe
```

**Variables de entorno necesarias:**

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASICO_MENSUAL=price_...
STRIPE_PRICE_BASICO_ANUAL=price_...
STRIPE_PRICE_PRO_MENSUAL=price_...
STRIPE_PRICE_PRO_ANUAL=price_...
STRIPE_PRICE_EMPRESA_MENSUAL=price_...
STRIPE_PRICE_EMPRESA_ANUAL=price_...
```

**Eventos de Stripe a manejar en el webhook:**

| Evento Stripe | Acción en BD |
|---|---|
| `checkout.session.completed` | Activar suscripción, guardar `stripe_customer_id` |
| `invoice.paid` | Registrar factura como pagada, extender `periodo_fin` |
| `invoice.payment_failed` | Marcar suscripción como `pausada`, notificar admin |
| `customer.subscription.deleted` | Marcar suscripción como `cancelada` |
| `customer.subscription.updated` | Actualizar plan y período |

### 6.3 Flujo de pago al crear un organismo

```
Usuario elige plan
        ↓
POST /api/billing/checkout
  { organismoId, planCodigo, intervalo: 'mensual' | 'anual' }
        ↓
Stripe Checkout Session
        ↓
Usuario introduce tarjeta en Stripe
        ↓
Stripe → webhook checkout.session.completed
        ↓
organismo_suscripciones.estado = 'activa'
        ↓
Redirect a /organismo/[slug]/dashboard
```

---

## 7. Aislamiento de datos entre organismos

### Row Level Security (RLS) en Supabase

Toda consulta a tablas de datos debe estar restringida al organismo activo del usuario. Esto se consigue con políticas RLS.

```sql
-- Ejemplo para la tabla tareas
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tareas_por_organismo" ON tareas
  FOR ALL
  USING (
    organismo_id IN (
      SELECT organismo_id FROM organismo_miembros
      WHERE usuario_id = auth.uid()
        AND activo = true
    )
  );
```

```sql
-- Ejemplo para responsables
ALTER TABLE responsables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "responsables_por_organismo" ON responsables
  FOR ALL
  USING (
    organismo_id IN (
      SELECT organismo_id FROM organismo_miembros
      WHERE usuario_id = auth.uid()
        AND activo = true
    )
  );
```

### Propagación del `organismo_id` en las APIs

Cada API route que actualmente opera sin contexto de organismo debe recibir el `organismo_id` desde la sesión:

```typescript
// Patrón a aplicar en todos los route handlers
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Obtener organismo activo desde cookie o header
  const organismoId = await getOrganismoActivoId(request, user?.id)
  if (!organismoId) return NextResponse.json({ error: 'Sin organismo activo' }, { status: 403 })

  // Todas las queries llevan .eq('organismo_id', organismoId)
  const { data } = await supabase
    .from('tareas')
    .select('*')
    .eq('organismo_id', organismoId)
    ...
}
```

---

## 8. Cambios en la aplicación existente

### 8.1 Nuevas rutas de la app

```
app/
  organismos/
    nuevo/page.tsx               # Crear organismo (paso 1: datos básicos)
    [slug]/
      page.tsx                   # Dashboard del organismo (= actual app/dashboard)
      ajustes/page.tsx           # Configuración del organismo
      miembros/page.tsx          # Gestión de miembros e invitaciones
      facturacion/page.tsx       # Plan, método de pago, facturas
      agenda/page.tsx            # Agenda de tareas (= actual app/page.tsx)
      ...resto de secciones
  seleccionar-organismo/page.tsx # Si el usuario pertenece a varios organismos
  planes/page.tsx                # Página pública de precios
```

### 8.2 Selector de organismo activo

Los usuarios que pertenecen a más de un organismo necesitan un selector en el sidebar o en el header.

```tsx
// components/OrganismoSelector.tsx  (nuevo)
// Muestra el organismo activo con un dropdown para cambiar
// Al cambiar: actualiza cookie organismo_activo_id y hace router.refresh()
```

### 8.3 Cambios en el Sidebar

El `Sidebar.tsx` actual no necesita cambiar su estructura, solo añadir:

- Logo e identificador del organismo activo en la cabecera del sidebar.
- Enlace a `/organismos/[slug]/miembros` (solo admins).
- Enlace a `/organismos/[slug]/facturacion` (solo admins).

### 8.4 Cambios en el middleware (`middleware.ts`)

```typescript
// middleware.ts (ampliado)
// 1. Verificar sesión de usuario (ya existe)
// 2. Resolver organismo activo de la cookie
// 3. Verificar que el usuario es miembro activo de ese organismo
// 4. Verificar que la suscripción del organismo está activa
//    → Si no: redirigir a /organismos/[slug]/facturacion
// 5. Propagar organismo_id en headers de la request para los route handlers
```

### 8.5 Cambios en `UserSessionProvider.tsx`

Ampliar el contexto con:

```typescript
interface UserSessionContextValue {
  // ... campos actuales ...
  organismoActivo: Organismo | null
  miOrganismos: OrganismoMiembro[]
  rolEnOrganismo: RolCodigo | null   // rol del usuario en el organismo activo
}
```

---

## 9. Flujo completo de alta de organismo

### Paso 1 — El usuario se registra (ya existe, sin cambios)

El usuario crea su cuenta en `/registro`. No queda asignado a ningún organismo todavía.

### Paso 2 — Crear organismo (`/organismos/nuevo`)

```
Formulario:
  - Nombre del organismo (requerido)
  - Tipo: Individual / Corporativo
  - Sector (opcional)
  - País

Al enviar → POST /api/organismos
  1. Crear fila en organismos
  2. Crear fila en organismo_miembros (usuario = administrador)
  3. Si plan de pago → iniciar Stripe Checkout
  4. Si plan gratuito → activar suscripción directamente
```

### Paso 3 — Pago (si aplica)

Stripe Checkout en nueva pestaña o redirección. Al completarse, el webhook activa la suscripción.

### Paso 4 — Configurar organismo

Tras el pago, el administrador aterriza en `/organismos/[slug]/ajustes` para:
- Subir logo.
- Configurar departamentos del organismo.
- Invitar miembros por correo.

### Paso 5 — Invitación de miembros

```
POST /api/organismos/[slug]/invitaciones
  { email, rolCodigo }

→ Registra invitación pendiente en BD
→ Envía email con enlace firmado (token de 48 h)
→ Al aceptar: se crea la fila en organismo_miembros
```

---

## 10. Migración desde el estado actual

El organismo actualmente existente (Segesa) se convierte en el primer organismo de la plataforma.

### Script de migración

```sql
-- 1. Crear el organismo "Segesa" (organismo semilla)
INSERT INTO organismos (id, nombre, slug, tipo, activo)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Segesa',
  'segesa',
  'corporativo',
  true
);

-- 2. Asignar todos los usuarios existentes al organismo Segesa
INSERT INTO organismo_miembros (organismo_id, usuario_id, rol_codigo)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  COALESCE(tu.codigo, 'responsable')
FROM perfiles p
LEFT JOIN tipos_usuario tu ON tu.id = p.tipo_usuario_id;

-- 3. Marcar todas las filas existentes con el organismo Segesa
UPDATE tareas       SET organismo_id = '00000000-0000-0000-0000-000000000001';
UPDATE responsables SET organismo_id = '00000000-0000-0000-0000-000000000001';
UPDATE departamentos SET organismo_id = '00000000-0000-0000-0000-000000000001';
UPDATE historial    SET organismo_id = '00000000-0000-0000-0000-000000000001';
UPDATE alertas      SET organismo_id = '00000000-0000-0000-0000-000000000001';

-- 4. Añadir NOT NULL una vez que todas las filas tienen valor
ALTER TABLE tareas        ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE responsables  ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE departamentos ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE historial     ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE alertas       ALTER COLUMN organismo_id SET NOT NULL;

-- 5. Crear suscripción gratuita/empresa para Segesa
INSERT INTO organismo_suscripciones (organismo_id, plan_codigo, estado)
VALUES ('00000000-0000-0000-0000-000000000001', 'empresa', 'activa');
```

### Compatibilidad de código durante la migración

Durante la transición, las APIs pueden tomar el `organismo_id` de un header inyectado por el middleware y continuar funcionando sin cambios internos. Solo se añade el `.eq('organismo_id', organismoId)` como filtro adicional.

---

## 11. Roadmap de implementación

### Fase 1 — Base de datos multi-organismo (1–2 semanas)

- [ ] Crear tablas `organismos`, `organismo_miembros`, `organismo_suscripciones`, `organismo_facturas`.
- [ ] Añadir columna `organismo_id` a todas las tablas de datos.
- [ ] Ejecutar script de migración sobre datos existentes.
- [ ] Configurar políticas RLS en Supabase.
- [ ] Actualizar `lib/types.ts` con los nuevos tipos.

### Fase 2 — Aislamiento en la aplicación (1–2 semanas)

- [ ] Crear `lib/organismo-access.ts` para resolver el organismo activo.
- [ ] Actualizar middleware para propagar `organismo_id`.
- [ ] Añadir `.eq('organismo_id', organismoId)` en todos los route handlers de la API.
- [ ] Actualizar `UserSessionProvider` con contexto de organismo.
- [ ] Crear componente `OrganismoSelector`.

### Fase 3 — Alta y gestión de organismos (2 semanas)

- [ ] Página `/organismos/nuevo` (formulario de creación).
- [ ] API `POST /api/organismos`.
- [ ] Página `/organismos/[slug]/miembros` con sistema de invitaciones por email.
- [ ] Página `/organismos/[slug]/ajustes`.
- [ ] Selector de organismo en el sidebar.

### Fase 4 — Planes y pagos (2 semanas)

- [ ] Instalar `stripe` y configurar `lib/stripe.ts`.
- [ ] Definir productos y precios en el dashboard de Stripe.
- [ ] Crear route handlers de checkout, portal y webhook.
- [ ] Página `/planes` (pública, con comparativa de planes).
- [ ] Página `/organismos/[slug]/facturacion`.
- [ ] Aplicar límites de plan en las APIs (tareas, usuarios).
- [ ] Redirigir a facturación cuando la suscripción está vencida.

### Fase 5 — Pulido y producción (1 semana)

- [ ] Tests de integración del flujo de pago en modo Stripe test.
- [ ] Validación de límites de plan en UI (mensajes cuando se alcanza el límite).
- [ ] Email de bienvenida al crear un organismo.
- [ ] Logging y monitorización de webhooks fallidos.

---

## Resumen de dependencias nuevas

```bash
npm install stripe               # Procesador de pagos
npm install @stripe/stripe-js    # Cliente Stripe (checkout)
```

---

## Consideraciones de seguridad

1. **El webhook de Stripe** debe verificar la firma con `stripe.webhooks.constructEvent` antes de procesar cualquier evento.
2. **Las APIs de organismo** deben comprobar que el usuario es miembro activo antes de operar. Nunca confiar únicamente en el `organismo_id` enviado por el cliente.
3. **Los tokens de invitación** deben tener caducidad (48 h) y ser de un solo uso.
4. **El `STRIPE_SECRET_KEY`** solo debe existir en el servidor. Nunca añadir `NEXT_PUBLIC_` a variables de Stripe.
5. Los límites de plan deben validarse en el servidor (API), no solo en el cliente (UI).
