-- Permite alertas generadas cuando una tarea queda completada.

ALTER TABLE public.alertas
  DROP CONSTRAINT IF EXISTS alertas_tipo_alerta_check;

ALTER TABLE public.alertas
  ADD CONSTRAINT alertas_tipo_alerta_check
  CHECK (
    tipo_alerta IN ('Asignada', 'Vencida', 'Urgente', 'Proxima', 'Próxima', 'Completada')
    OR tipo_alerta LIKE 'Pr%xima'
  );
