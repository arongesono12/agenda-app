# Propuesta: Documentos PDF y firma en tareas

## Objetivo

Ampliar el modulo de tareas para que las tareas creadas o asignadas a supervisores y responsables puedan tener documentos PDF adjuntos, y que esos documentos puedan ser revisados, firmados y auditados dentro del flujo operativo de la aplicacion.

La funcionalidad debe integrarse con:

- Agenda diaria.
- Tareas asignadas.
- Historial de tarea.
- Reasignaciones.
- Alertas.
- Roles por organismo.
- Auditoria de acciones.

## Factibilidad

La opcion es factible porque el proyecto ya cuenta con varias bases necesarias:

- Gestion de tareas oficiales en `tareas`.
- Multi-asignacion por usuario en `tarea_asignaciones`.
- Historial auditable en `historial`.
- Alertas por usuario y organismo en `alertas`.
- Control de acceso por organismo.
- Supabase Storage ya usado para avatares.

Lo que falta es crear una capa especifica para documentos de tarea y otra capa para firmas.

## Principio de diseno

No se recomienda guardar un unico campo `pdf_url` dentro de `tareas`, porque una tarea puede tener:

- Varios documentos.
- Documentos generales de la tarea.
- Documentos agregados por un supervisor al reasignar.
- Documentos agregados por un responsable como evidencia.
- Documentos que requieren firma.
- Documentos firmados por varias personas.

La forma correcta es crear tablas separadas para adjuntos y firmas.

## Alcance funcional propuesto

### Documentos PDF en tareas

Cada tarea podra tener documentos PDF adjuntos. Estos documentos pueden agregarse en distintos momentos:

- Al crear una tarea.
- Al editar una tarea.
- Al reasignar una tarea desde el historial.
- Al registrar una observacion, avance, incidencia u orden.
- Al completar una parte de una tarea.

Cada documento debe quedar asociado a la tarea y opcionalmente a una asignacion o entrada de historial.

### Firma de documentos PDF

Los PDFs adjuntos podran requerir firma por parte de uno o varios usuarios.

El flujo recomendado para un documento firmado es:

```text
Subido -> Pendiente de firma -> Firmado -> Validado / Rechazado
```

Cada firma debe registrar:

- Documento firmado.
- Usuario firmante.
- Nombre del firmante.
- Rol del firmante.
- Organismo.
- Fecha y hora de firma.
- Hash del documento original.
- Hash del documento firmado.
- IP y navegador cuando sea posible.
- Observacion opcional.
- Ruta del PDF firmado.

## Casos de uso

### Caso 1: Administrador crea tarea con documento

1. El administrador crea una tarea.
2. Adjunta uno o varios PDFs.
3. Selecciona supervisor o responsables.
4. El sistema guarda la tarea.
5. El sistema guarda los documentos.
6. Los usuarios asignados reciben alerta.
7. Los usuarios pueden abrir la tarea y ver los PDFs.

### Caso 2: Supervisor reasigna tarea con instrucciones en PDF

1. El supervisor abre el historial de una tarea asignada.
2. Selecciona un responsable de su departamento.
3. Escribe una observacion.
4. Adjunta un PDF con instrucciones o soporte.
5. Reasigna la tarea.
6. El responsable recibe alerta.
7. El historial muestra la observacion y el documento adjunto.

### Caso 3: Responsable sube evidencia

1. El responsable abre una tarea asignada.
2. Registra un avance en el historial.
3. Adjunta un PDF como evidencia.
4. El sistema guarda el historial y el documento.
5. El administrador puede revisar la evidencia.

### Caso 4: Responsable firma un documento

1. El responsable recibe una tarea con documento pendiente de firma.
2. Abre el PDF desde la tarea.
3. Pulsa "Firmar documento".
4. Confirma que ha revisado el contenido.
5. El sistema registra la firma.
6. El sistema genera una version firmada del PDF con sello visible.
7. El historial registra la firma.

### Caso 5: Documento con varias firmas

1. Una tarea tiene un documento que requiere firma de varios responsables.
2. Cada usuario firma su parte.
3. El documento permanece pendiente mientras falten firmas.
4. Cuando todos firman, el estado pasa a firmado.
5. El administrador puede validar o rechazar el documento.

## Modelo de datos recomendado

### Tabla `tarea_documentos`

Tabla para registrar los documentos PDF subidos.

```sql
CREATE TABLE public.tarea_documentos (
  id BIGSERIAL PRIMARY KEY,
  organismo_id UUID NOT NULL REFERENCES public.organismos(id) ON DELETE CASCADE,
  tarea_id BIGINT NOT NULL REFERENCES public.tareas(id) ON DELETE CASCADE,
  asignacion_id BIGINT REFERENCES public.tarea_asignaciones(id) ON DELETE SET NULL,
  historial_id BIGINT REFERENCES public.historial(id) ON DELETE SET NULL,
  subido_por_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL,
  nombre_archivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  descripcion TEXT,
  requiere_firma BOOLEAN NOT NULL DEFAULT FALSE,
  estado TEXT NOT NULL DEFAULT 'subido',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  eliminado_at TIMESTAMPTZ,
  eliminado_por_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL
);
```

Estados sugeridos:

```text
subido
pendiente_firma
firmado
validado
rechazado
anulado
```

### Tabla `tarea_documento_firmas`

Tabla para registrar cada firma realizada sobre un documento.

```sql
CREATE TABLE public.tarea_documento_firmas (
  id BIGSERIAL PRIMARY KEY,
  documento_id BIGINT NOT NULL REFERENCES public.tarea_documentos(id) ON DELETE CASCADE,
  tarea_id BIGINT NOT NULL REFERENCES public.tareas(id) ON DELETE CASCADE,
  organismo_id UUID NOT NULL REFERENCES public.organismos(id) ON DELETE CASCADE,
  firmante_usuario_id UUID NOT NULL REFERENCES public.perfiles_usuario(id) ON DELETE CASCADE,
  firmante_nombre TEXT NOT NULL,
  firmante_rol_codigo TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  tipo_firma TEXT NOT NULL DEFAULT 'simple',
  firmado_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  hash_documento_original TEXT,
  hash_documento_firmado TEXT,
  storage_path_firmado TEXT,
  observacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Estados sugeridos:

```text
pendiente
firmado
rechazado
anulado
```

Tipos de firma sugeridos:

```text
simple
avanzada
certificado_digital
```

## Supabase Storage

Se recomienda crear un bucket privado:

```text
task-documents
```

No debe ser publico, porque los documentos de tareas pueden contener informacion sensible del organismo.

Ruta recomendada:

```text
task-documents/{organismo_id}/{tarea_id}/original/{documento_id}.pdf
task-documents/{organismo_id}/{tarea_id}/signed/{documento_id}-{firma_id}.pdf
```

La descarga debe hacerse mediante URLs firmadas temporales, no con URLs publicas.

## Niveles de firma

### Nivel 1: Firma simple

El usuario confirma desde la aplicacion que ha revisado y firmado el documento.

Ejemplo de declaracion:

```text
Confirmo que he revisado este documento y lo firmo como parte del seguimiento de esta tarea.
```

Ventajas:

- Rapida de implementar.
- Util para trazabilidad interna.
- No requiere certificados externos.
- Encaja bien con supervisores y responsables.

Limitacion:

- No equivale necesariamente a una firma digital avanzada con validez legal plena.

### Nivel 2: PDF con sello visual

Despues de firmar, el sistema genera una copia del PDF con un sello visible.

Contenido sugerido del sello:

```text
Firmado por: Nombre del usuario
Rol: Supervisor / Responsable
Organismo: Nombre del organismo
Fecha: 16/06/2026 14:35
Tarea: Nombre de la tarea
Codigo de verificacion: DOC-2026-000123
```

Ventajas:

- El PDF descargado ya muestra evidencia visual.
- Facilita la revision por administradores.
- Mejora la auditoria interna.

### Nivel 3: Firma digital avanzada

Este nivel implicaria certificados digitales o proveedor externo de firma.

Opciones:

- Certificado `.p12` o `.pfx`.
- Proveedor externo de firma electronica.
- OTP o doble confirmacion.
- Sellado de tiempo.

Recomendacion:

No iniciar por este nivel. Primero implementar firma simple con sello visual y auditoria.

## Permisos recomendados

### Administrador / administradora

- Puede subir documentos a tareas de su organismo.
- Puede ver todos los documentos del organismo.
- Puede solicitar firmas.
- Puede validar o rechazar documentos firmados.
- Puede eliminar logicamente documentos.

### Supervisor

- Puede ver documentos de tareas asignadas a su usuario.
- Puede ver documentos de tareas que haya delegado a responsables.
- Puede subir documentos al reasignar tareas.
- Puede firmar documentos asignados a su usuario.
- No debe ver documentos de tareas fuera de su alcance.

### Responsable

- Puede ver documentos de tareas asignadas a su usuario.
- Puede subir evidencias en el historial.
- Puede firmar documentos que requieran su firma.
- No debe ver documentos de otros responsables si no comparte la tarea.

### Consulta

- Solo lectura segun el alcance permitido por el organismo.
- No debe firmar ni subir documentos, salvo que se decida ampliar el rol.

## Integracion con historial

Cada accion documental debe crear una entrada en `historial`.

Eventos sugeridos:

```text
Documento adjuntado
Documento eliminado
Firma solicitada
Documento firmado
Firma rechazada
Documento validado
Documento rechazado
```

Ejemplo:

```text
Tipo de cambio: Documento firmado
Valor anterior: Pendiente de firma
Valor nuevo: Firmado
Observaciones: Firmado por Juan Perez como Responsable.
```

## Integracion con alertas

Las alertas deben notificar solo a los usuarios correspondientes.

Alertas sugeridas:

- Nueva tarea con documento adjunto.
- Documento pendiente de firma.
- Documento firmado por responsable.
- Documento rechazado.
- Documento validado.

Regla importante:

No enviar el PDF como adjunto por correo. El correo solo debe avisar y llevar al usuario a la aplicacion. La descarga debe hacerse dentro de la app mediante permisos y URL firmada temporal.

## Cambios de interfaz necesarios

### En `TaskModal`

Agregar seccion:

```text
Documentos PDF
- Subir PDF
- Nombre del archivo
- Requiere firma
- Firmantes requeridos
```

### En `TaskHistorialModal`

Agregar:

```text
Adjuntar PDF a esta entrada
Documentos relacionados con esta entrada
Firmar documento
Ver estado de firmas
```

### En tarjetas de Agenda Diaria

Mostrar indicador:

```text
3 documentos
1 pendiente de firma
```

### En detalle de tarea

Agregar panel:

```text
Documentos
- Nombre
- Subido por
- Fecha
- Estado
- Firmas
- Descargar
- Firmar
```

## Seguridad

Recomendaciones obligatorias:

- Usar bucket privado.
- Validar MIME type `application/pdf`.
- Validar extension `.pdf`.
- Limitar tamano por archivo.
- Generar URL firmada temporal para descargar.
- No exponer `storage_path` directamente al cliente como permiso permanente.
- Registrar hash SHA-256 del PDF original.
- Registrar hash SHA-256 del PDF firmado.
- No sobrescribir el PDF original.
- Mantener eliminacion logica con `eliminado_at`.
- Registrar usuario, rol, organismo, IP y navegador al firmar.

## Versionado de documentos

No se recomienda reemplazar un PDF existente.

Si se sube una nueva version:

- Se crea un nuevo registro en `tarea_documentos`.
- Se marca la version anterior como reemplazada o anulada.
- Se conserva el historial.
- Las firmas anteriores siguen asociadas al documento anterior.

Esto evita perder evidencia.

## Fases de implementacion recomendadas

### Fase 1: Adjuntos PDF basicos

- Crear bucket privado.
- Crear tabla `tarea_documentos`.
- Subir PDFs desde tareas.
- Listar documentos en detalle e historial.
- Descargar con URL firmada.

### Fase 2: Adjuntos en historial y reasignaciones

- Permitir adjuntar PDFs al registrar historial.
- Permitir adjuntar PDFs al reasignar.
- Mostrar documentos por entrada de historial.
- Crear alertas cuando una asignacion incluya documento.

### Fase 3: Firma simple

- Crear tabla `tarea_documento_firmas`.
- Permitir solicitar firma.
- Permitir firmar desde la app.
- Registrar firma en historial.
- Mostrar estado de firma.

### Fase 4: PDF firmado con sello visual

- Generar copia firmada del PDF.
- Agregar sello visible.
- Guardar hash original y hash firmado.
- Permitir descargar version firmada.

### Fase 5: Validacion administrativa

- Administradores validan o rechazan documentos firmados.
- Registrar decisiones en historial.
- Alertar al responsable si el documento fue rechazado.

### Fase 6: Firma digital avanzada

- Evaluar proveedor externo.
- Evaluar certificados.
- Evaluar requisitos legales.
- Integrar solo si el uso real lo exige.

## Riesgos y mitigaciones

### Riesgo: documentos visibles para usuarios incorrectos

Mitigacion:

- Validar permisos siempre desde API.
- Filtrar por organismo.
- Filtrar por tarea asignada.
- No usar bucket publico.

### Riesgo: perdida de evidencia

Mitigacion:

- No sobrescribir PDFs.
- Guardar versiones.
- Usar eliminacion logica.
- Registrar hashes.

### Riesgo: firma sin valor suficiente

Mitigacion:

- Definir claramente que la primera version es firma interna/auditable.
- Agregar sello visible.
- Registrar evidencia tecnica.
- Evaluar firma avanzada solo si es necesaria.

### Riesgo: crecimiento de almacenamiento

Mitigacion:

- Limites por plan.
- Limites por archivo.
- Politica de retencion.
- Compresion o rechazo de PDFs excesivamente grandes.

## Recomendacion final

La opcion es viable y encaja bien con el estado actual del proyecto.

La recomendacion es implementarla en este orden:

1. Documentos PDF privados por tarea.
2. Documentos vinculados al historial.
3. Firma simple con auditoria.
4. PDF firmado con sello visual.
5. Validacion administrativa.
6. Firma digital avanzada solo si hace falta.

La primera version debe priorizar seguridad, trazabilidad y claridad para el usuario. La firma avanzada puede esperar hasta que el flujo interno este probado.
