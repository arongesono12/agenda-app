-- Asegura que el historial automatico de tareas respete el organismo obligatorio.

CREATE OR REPLACE FUNCTION public.log_tarea_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historial (
      tarea_id,
      tarea_nombre,
      modulo,
      tipo_cambio,
      valor_nuevo,
      organismo_id
    )
    VALUES (
      NEW.id,
      NEW.tarea,
      'Agenda de Control',
      'Creación',
      NEW.estado,
      NEW.organismo_id
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
      INSERT INTO public.historial (
        tarea_id,
        tarea_nombre,
        modulo,
        tipo_cambio,
        valor_anterior,
        valor_nuevo,
        organismo_id
      )
      VALUES (
        NEW.id,
        NEW.tarea,
        'Agenda de Control',
        'Cambio de Estado',
        OLD.estado,
        NEW.estado,
        NEW.organismo_id
      );
    END IF;

    IF OLD.porcentaje_avance IS DISTINCT FROM NEW.porcentaje_avance THEN
      INSERT INTO public.historial (
        tarea_id,
        tarea_nombre,
        modulo,
        tipo_cambio,
        valor_anterior,
        valor_nuevo,
        organismo_id
      )
      VALUES (
        NEW.id,
        NEW.tarea,
        'Agenda de Control',
        'Actualización % Avance',
        OLD.porcentaje_avance::TEXT || '%',
        NEW.porcentaje_avance::TEXT || '%',
        NEW.organismo_id
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.historial (
      tarea_nombre,
      modulo,
      tipo_cambio,
      valor_anterior,
      organismo_id
    )
    VALUES (
      OLD.tarea,
      'Agenda de Control',
      'Eliminación',
      OLD.estado,
      OLD.organismo_id
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
