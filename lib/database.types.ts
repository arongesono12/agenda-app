export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      alertas: {
        Row: {
          id: number
          tarea_id: number | null
          tipo_alerta: string
          fecha_alerta: string | null
          leida: boolean | null
          created_at: string | null
          destinatario_usuario_id: string | null
          destinatario_email: string | null
          titulo: string | null
          mensaje: string | null
          enviada_email_at: string | null
          email_error: string | null
          alerta_key: string | null
          organismo_id: string | null
        }
        Insert: {
          id?: number
          tarea_id?: number | null
          tipo_alerta: string
          fecha_alerta?: string | null
          leida?: boolean | null
          created_at?: string | null
          destinatario_usuario_id?: string | null
          destinatario_email?: string | null
          titulo?: string | null
          mensaje?: string | null
          enviada_email_at?: string | null
          email_error?: string | null
          alerta_key?: string | null
          organismo_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['alertas']['Insert']>
        Relationships: []
      }
      departamentos: {
        Row: {
          id: number
          nombre: string
          activo: boolean | null
          organismo_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          nombre: string
          activo?: boolean | null
          organismo_id?: string | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['departamentos']['Insert']>
        Relationships: []
      }
      historial: {
        Row: {
          id: number
          fecha: string | null
          usuario: string | null
          tarea_id: number | null
          tarea_nombre: string | null
          modulo: string | null
          tipo_cambio: string
          valor_anterior: string | null
          valor_nuevo: string | null
          observaciones: string | null
          actor_usuario_id: string | null
          actor_rol_codigo: string | null
          editado_at: string | null
          editado_por_usuario_id: string | null
          eliminado_at: string | null
          eliminado_por_usuario_id: string | null
          motivo_eliminacion: string | null
          organismo_id: string | null
        }
        Insert: {
          id?: number
          fecha?: string | null
          usuario?: string | null
          tarea_id?: number | null
          tarea_nombre?: string | null
          modulo?: string | null
          tipo_cambio: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
          observaciones?: string | null
          actor_usuario_id?: string | null
          actor_rol_codigo?: string | null
          editado_at?: string | null
          editado_por_usuario_id?: string | null
          eliminado_at?: string | null
          eliminado_por_usuario_id?: string | null
          motivo_eliminacion?: string | null
          organismo_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['historial']['Insert']>
        Relationships: []
      }
      perfiles_usuario: {
        Row: {
          id: string
          email: string
          nombre_completo: string | null
          tipo_usuario_id: number | null
          avatar_url: string | null
          preferencias: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email: string
          nombre_completo?: string | null
          tipo_usuario_id?: number | null
          avatar_url?: string | null
          preferencias?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['perfiles_usuario']['Insert']>
        Relationships: []
      }
      responsables: {
        Row: {
          id: number
          nombre: string
          email: string | null
          usuario_id: string | null
          departamento: string | null
          cargo: string | null
          activo: boolean | null
          organismo_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          nombre: string
          email?: string | null
          usuario_id?: string | null
          departamento?: string | null
          cargo?: string | null
          activo?: boolean | null
          organismo_id?: string | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['responsables']['Insert']>
        Relationships: []
      }
      tareas: {
        Row: {
          id: number
          codigo_id: number | null
          tarea: string
          prioridad: string
          departamento: string | null
          seccion: string | null
          responsable: string | null
          responsable_id: number | null
          responsable_usuario_id: string | null
          asignado_por_usuario_id: string | null
          asignado_por_nombre: string | null
          fecha_inicio: string | null
          fecha_fin: string | null
          dias_totales: number | null
          porcentaje_avance: number | null
          dias_restantes: number | null
          semaforo: string | null
          estado: string
          tipo_tarea: string | null
          ultima_actualizacion: string | null
          notas: string | null
          organismo_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          codigo_id?: number | null
          tarea: string
          prioridad?: string
          departamento?: string | null
          seccion?: string | null
          responsable?: string | null
          responsable_id?: number | null
          responsable_usuario_id?: string | null
          asignado_por_usuario_id?: string | null
          asignado_por_nombre?: string | null
          fecha_inicio?: string | null
          fecha_fin?: string | null
          porcentaje_avance?: number | null
          dias_restantes?: number | null
          semaforo?: string | null
          estado?: string
          tipo_tarea?: string | null
          ultima_actualizacion?: string | null
          notas?: string | null
          organismo_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['tareas']['Insert']>
        Relationships: []
      }
      tarea_asignaciones: {
        Row: {
          id: number
          tarea_id: number
          responsable_id: number | null
          responsable_usuario_id: string | null
          responsable_nombre: string
          responsable_email: string | null
          departamento: string | null
          rol_codigo: string | null
          asignado_por_usuario_id: string | null
          asignado_por_nombre: string | null
          activo: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: number
          tarea_id: number
          responsable_id?: number | null
          responsable_usuario_id?: string | null
          responsable_nombre: string
          responsable_email?: string | null
          departamento?: string | null
          rol_codigo?: string | null
          asignado_por_usuario_id?: string | null
          asignado_por_nombre?: string | null
          activo?: boolean | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['tarea_asignaciones']['Insert']>
        Relationships: []
      }
      tarea_departamentos: {
        Row: {
          id: number
          tarea_id: number
          departamento: string
          created_at: string | null
        }
        Insert: {
          id?: number
          tarea_id: number
          departamento: string
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['tarea_departamentos']['Insert']>
        Relationships: []
      }
      tipos_usuario: {
        Row: {
          id: number
          codigo: string
          nombre: string
          descripcion: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          codigo: string
          nombre: string
          descripcion?: string | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['tipos_usuario']['Insert']>
        Relationships: []
      }
      organismos: {
        Row: {
          id: string
          nombre: string
          slug: string
          tipo: string
          logo_url: string | null
          website: string | null
          sector: string | null
          pais: string | null
          activo: boolean
          creado_por: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          nombre: string
          slug: string
          tipo?: string
          logo_url?: string | null
          website?: string | null
          sector?: string | null
          pais?: string | null
          activo?: boolean
          creado_por?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['organismos']['Insert']>
        Relationships: []
      }
      mis_tareas: {
        Row: {
          id: number
          usuario_id: string
          titulo: string
          descripcion: string | null
          fecha: string | null
          completada: boolean
          completada_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          usuario_id: string
          titulo: string
          descripcion?: string | null
          fecha?: string | null
          completada?: boolean
          completada_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['mis_tareas']['Insert']>
        Relationships: []
      }
      organismo_miembros: {
        Row: {
          id: number
          organismo_id: string
          usuario_id: string
          rol_codigo: string
          activo: boolean
          invitado_por: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          organismo_id: string
          usuario_id: string
          rol_codigo: string
          activo?: boolean
          invitado_por?: string | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['organismo_miembros']['Insert']>
        Relationships: []
      }
      organismo_suscripciones: {
        Row: {
          id: number
          organismo_id: string
          plan_codigo: string
          estado: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          periodo_inicio: string | null
          periodo_fin: string | null
          trial_fin: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          organismo_id: string
          plan_codigo: string
          estado?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          periodo_inicio?: string | null
          periodo_fin?: string | null
          trial_fin?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['organismo_suscripciones']['Insert']>
        Relationships: []
      }
      organismo_facturas: {
        Row: {
          id: number
          organismo_id: string
          stripe_invoice_id: string | null
          importe_centimos: number
          moneda: string
          estado: string
          pdf_url: string | null
          fecha_emision: string | null
          fecha_vencimiento: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          organismo_id: string
          stripe_invoice_id?: string | null
          importe_centimos: number
          moneda?: string
          estado?: string
          pdf_url?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['organismo_facturas']['Insert']>
        Relationships: []
      }
      organismo_invitaciones: {
        Row: {
          id: number
          organismo_id: string
          email: string
          rol_codigo: string
          token: string
          usado: boolean
          expira_at: string | null
          invitado_por: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          organismo_id: string
          email: string
          rol_codigo?: string
          token?: string
          usado?: boolean
          expira_at?: string | null
          invitado_por?: string | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['organismo_invitaciones']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      api_dashboard_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      api_estadisticas_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      current_role_code: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      current_user_departamentos: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      has_any_role: {
        Args: { allowed_codes: string[] }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
