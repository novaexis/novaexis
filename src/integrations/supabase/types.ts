export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agendamentos_saude: {
        Row: {
          cidadao_id: string | null
          created_at: string
          data_hora: string
          especialidade: string | null
          id: string
          observacoes: string | null
          status: Database["public"]["Enums"]["agendamento_status"]
          tenant_id: string
          tipo: string
          unidade_saude: string
          updated_at: string
        }
        Insert: {
          cidadao_id?: string | null
          created_at?: string
          data_hora: string
          especialidade?: string | null
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          tenant_id: string
          tipo: string
          unidade_saude: string
          updated_at?: string
        }
        Update: {
          cidadao_id?: string | null
          created_at?: string
          data_hora?: string
          especialidade?: string | null
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          tenant_id?: string
          tipo?: string
          unidade_saude?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_saude_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_saude_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_prazos: {
        Row: {
          created_at: string
          criado_automaticamente: boolean
          descricao: string | null
          fonte: string | null
          id: string
          prazo: string | null
          requisitos: Json | null
          status: Database["public"]["Enums"]["alerta_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["alerta_tipo"]
          titulo: string
          updated_at: string
          url_edital: string | null
          valor_estimado: number | null
        }
        Insert: {
          created_at?: string
          criado_automaticamente?: boolean
          descricao?: string | null
          fonte?: string | null
          id?: string
          prazo?: string | null
          requisitos?: Json | null
          status?: Database["public"]["Enums"]["alerta_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["alerta_tipo"]
          titulo: string
          updated_at?: string
          url_edital?: string | null
          valor_estimado?: number | null
        }
        Update: {
          created_at?: string
          criado_automaticamente?: boolean
          descricao?: string | null
          fonte?: string | null
          id?: string
          prazo?: string | null
          requisitos?: Json | null
          status?: Database["public"]["Enums"]["alerta_status"]
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["alerta_tipo"]
          titulo?: string
          updated_at?: string
          url_edital?: string | null
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_prazos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_prazos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas: {
        Row: {
          anexos: string[] | null
          cidadao_id: string | null
          concluida_at: string | null
          created_at: string
          descricao: string | null
          endereco: string | null
          id: string
          latitude: number | null
          longitude: number | null
          prazo_sla: string | null
          prioridade: Database["public"]["Enums"]["demanda_prioridade"]
          protocolo: string
          secretaria_slug: string
          status: Database["public"]["Enums"]["demanda_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["demanda_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          anexos?: string[] | null
          cidadao_id?: string | null
          concluida_at?: string | null
          created_at?: string
          descricao?: string | null
          endereco?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          prazo_sla?: string | null
          prioridade?: Database["public"]["Enums"]["demanda_prioridade"]
          protocolo: string
          secretaria_slug: string
          status?: Database["public"]["Enums"]["demanda_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["demanda_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          anexos?: string[] | null
          cidadao_id?: string | null
          concluida_at?: string | null
          created_at?: string
          descricao?: string | null
          endereco?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          prazo_sla?: string | null
          prioridade?: Database["public"]["Enums"]["demanda_prioridade"]
          protocolo?: string
          secretaria_slug?: string
          status?: Database["public"]["Enums"]["demanda_status"]
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["demanda_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          created_at: string
          fonte: string | null
          id: string
          indicador: string
          referencia_data: string
          secretaria_slug: string
          status: Database["public"]["Enums"]["kpi_status"]
          tenant_id: string
          unidade: string | null
          valor: number
          variacao_pct: number | null
        }
        Insert: {
          created_at?: string
          fonte?: string | null
          id?: string
          indicador: string
          referencia_data: string
          secretaria_slug: string
          status?: Database["public"]["Enums"]["kpi_status"]
          tenant_id: string
          unidade?: string | null
          valor: number
          variacao_pct?: number | null
        }
        Update: {
          created_at?: string
          fonte?: string | null
          id?: string
          indicador?: string
          referencia_data?: string
          secretaria_slug?: string
          status?: Database["public"]["Enums"]["kpi_status"]
          tenant_id?: string
          unidade?: string | null
          valor?: number
          variacao_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          created_at: string
          data_nascimento: string | null
          escola: string
          id: string
          nome_aluno: string
          observacoes: string | null
          responsavel_id: string | null
          serie: string | null
          status: Database["public"]["Enums"]["matricula_status"]
          tenant_id: string
          turno: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          escola: string
          id?: string
          nome_aluno: string
          observacoes?: string | null
          responsavel_id?: string | null
          serie?: string | null
          status?: Database["public"]["Enums"]["matricula_status"]
          tenant_id: string
          turno?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          escola?: string
          id?: string
          nome_aluno?: string
          observacoes?: string | null
          responsavel_id?: string | null
          serie?: string | null
          status?: Database["public"]["Enums"]["matricula_status"]
          tenant_id?: string
          turno?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      mencoes_sociais: {
        Row: {
          alcance: number | null
          autor: string | null
          coletado_at: string
          conteudo: string
          id: string
          plataforma: Database["public"]["Enums"]["plataforma_social"]
          processado_at: string | null
          score_sentimento: number | null
          secretarias_impactadas: string[] | null
          sentimento: Database["public"]["Enums"]["sentimento"] | null
          temas: string[] | null
          tenant_id: string
          url: string | null
        }
        Insert: {
          alcance?: number | null
          autor?: string | null
          coletado_at?: string
          conteudo: string
          id?: string
          plataforma: Database["public"]["Enums"]["plataforma_social"]
          processado_at?: string | null
          score_sentimento?: number | null
          secretarias_impactadas?: string[] | null
          sentimento?: Database["public"]["Enums"]["sentimento"] | null
          temas?: string[] | null
          tenant_id: string
          url?: string | null
        }
        Update: {
          alcance?: number | null
          autor?: string | null
          coletado_at?: string
          conteudo?: string
          id?: string
          plataforma?: Database["public"]["Enums"]["plataforma_social"]
          processado_at?: string | null
          score_sentimento?: number | null
          secretarias_impactadas?: string[] | null
          sentimento?: Database["public"]["Enums"]["sentimento"] | null
          temas?: string[] | null
          tenant_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mencoes_sociais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mencoes_sociais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cpf_mascarado: string | null
          created_at: string
          email: string | null
          gov_br_sub: string | null
          id: string
          nome: string | null
          reseller_id: string | null
          telefone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          cpf_mascarado?: string | null
          created_at?: string
          email?: string | null
          gov_br_sub?: string | null
          id: string
          nome?: string | null
          reseller_id?: string | null
          telefone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          cpf_mascarado?: string | null
          created_at?: string
          email?: string | null
          gov_br_sub?: string | null
          id?: string
          nome?: string | null
          reseller_id?: string | null
          telefone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      scores_aprovacao: {
        Row: {
          data: string
          id: string
          negativas: number
          neutras: number
          positivas: number
          score: number
          temas_trending: Json | null
          tenant_id: string
          total_mencoes: number
        }
        Insert: {
          data: string
          id?: string
          negativas?: number
          neutras?: number
          positivas?: number
          score: number
          temas_trending?: Json | null
          tenant_id: string
          total_mencoes?: number
        }
        Update: {
          data?: string
          id?: string
          negativas?: number
          neutras?: number
          positivas?: number
          score?: number
          temas_trending?: Json | null
          tenant_id?: string
          total_mencoes?: number
        }
        Relationships: [
          {
            foreignKeyName: "scores_aprovacao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_aprovacao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      secretarias: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          secretario_id: string | null
          slug: string
          tenant_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          secretario_id?: string | null
          slug: string
          tenant_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          secretario_id?: string | null
          slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretarias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretarias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ativo: boolean
          bioma: string | null
          created_at: string
          estado: string
          ibge_codigo: string | null
          id: string
          idhm: number | null
          nome: string
          plano: Database["public"]["Enums"]["tenant_plano"] | null
          populacao: number | null
          reseller_id: string | null
          slug: string
          stripe_subscription_id: string | null
          tipo: Database["public"]["Enums"]["tenant_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bioma?: string | null
          created_at?: string
          estado?: string
          ibge_codigo?: string | null
          id?: string
          idhm?: number | null
          nome: string
          plano?: Database["public"]["Enums"]["tenant_plano"] | null
          populacao?: number | null
          reseller_id?: string | null
          slug: string
          stripe_subscription_id?: string | null
          tipo?: Database["public"]["Enums"]["tenant_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bioma?: string | null
          created_at?: string
          estado?: string
          ibge_codigo?: string | null
          id?: string
          idhm?: number | null
          nome?: string
          plano?: Database["public"]["Enums"]["tenant_plano"] | null
          populacao?: number | null
          reseller_id?: string | null
          slug?: string
          stripe_subscription_id?: string | null
          tipo?: Database["public"]["Enums"]["tenant_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          secretaria_slug: string | null
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          secretaria_slug?: string | null
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          secretaria_slug?: string | null
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      tenants_public: {
        Row: {
          ativo: boolean | null
          bioma: string | null
          estado: string | null
          ibge_codigo: string | null
          id: string | null
          idhm: number | null
          nome: string | null
          populacao: number | null
          slug: string | null
          tipo: Database["public"]["Enums"]["tenant_tipo"] | null
        }
        Insert: {
          ativo?: boolean | null
          bioma?: string | null
          estado?: string | null
          ibge_codigo?: string | null
          id?: string | null
          idhm?: number | null
          nome?: string | null
          populacao?: number | null
          slug?: string | null
          tipo?: Database["public"]["Enums"]["tenant_tipo"] | null
        }
        Update: {
          ativo?: boolean | null
          bioma?: string | null
          estado?: string | null
          ibge_codigo?: string | null
          id?: string | null
          idhm?: number | null
          nome?: string | null
          populacao?: number | null
          slug?: string | null
          tipo?: Database["public"]["Enums"]["tenant_tipo"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_secretaria_slug: { Args: { _user_id: string }; Returns: string }
      get_user_tenant: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_tenant: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant: string
          _user_id: string
        }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      agendamento_status:
        | "agendado"
        | "confirmado"
        | "realizado"
        | "cancelado"
        | "faltou"
      alerta_status: "disponivel" | "em_andamento" | "perdido" | "captado"
      alerta_tipo:
        | "recurso_federal"
        | "recurso_estadual"
        | "obrigacao_legal"
        | "licitacao"
        | "comunicado_estado"
      app_role:
        | "superadmin"
        | "governador"
        | "prefeito"
        | "secretario"
        | "cidadao"
        | "admin_parceiro"
      demanda_prioridade: "baixa" | "media" | "alta" | "urgente"
      demanda_status:
        | "aberta"
        | "em_analise"
        | "em_andamento"
        | "concluida"
        | "rejeitada"
      demanda_tipo:
        | "servico"
        | "reclamacao"
        | "sugestao"
        | "seguranca"
        | "elogio"
      kpi_status: "ok" | "atencao" | "critico"
      matricula_status: "solicitada" | "em_analise" | "deferida" | "indeferida"
      plataforma_social:
        | "facebook"
        | "instagram"
        | "twitter"
        | "google_maps"
        | "noticias"
      sentimento: "positivo" | "negativo" | "neutro"
      tenant_plano: "basico" | "completo" | "estado"
      tenant_tipo: "municipio" | "estado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agendamento_status: [
        "agendado",
        "confirmado",
        "realizado",
        "cancelado",
        "faltou",
      ],
      alerta_status: ["disponivel", "em_andamento", "perdido", "captado"],
      alerta_tipo: [
        "recurso_federal",
        "recurso_estadual",
        "obrigacao_legal",
        "licitacao",
        "comunicado_estado",
      ],
      app_role: [
        "superadmin",
        "governador",
        "prefeito",
        "secretario",
        "cidadao",
        "admin_parceiro",
      ],
      demanda_prioridade: ["baixa", "media", "alta", "urgente"],
      demanda_status: [
        "aberta",
        "em_analise",
        "em_andamento",
        "concluida",
        "rejeitada",
      ],
      demanda_tipo: [
        "servico",
        "reclamacao",
        "sugestao",
        "seguranca",
        "elogio",
      ],
      kpi_status: ["ok", "atencao", "critico"],
      matricula_status: ["solicitada", "em_analise", "deferida", "indeferida"],
      plataforma_social: [
        "facebook",
        "instagram",
        "twitter",
        "google_maps",
        "noticias",
      ],
      sentimento: ["positivo", "negativo", "neutro"],
      tenant_plano: ["basico", "completo", "estado"],
      tenant_tipo: ["municipio", "estado"],
    },
  },
} as const
