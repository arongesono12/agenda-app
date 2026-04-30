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
        }
        Update: Partial<Database['public']['Tables']['alertas']['Insert']>
        Relationships: []
      }
      departamentos: {
        Row: {
          id: number
          nombre: string
          activo: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: number
          nombre: string
          activo?: boolean | null
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
          fecha_inicio?: string | null
          fecha_fin?: string | null
          porcentaje_avance?: number | null
          dias_restantes?: number | null
          semaforo?: string | null
          estado?: string
          tipo_tarea?: string | null
          ultima_actualizacion?: string | null
          notas?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['tareas']['Insert']>
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
