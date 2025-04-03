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
      anticipation_receivables: {
        Row: {
          anticipation_id: string
          created_at: string
          id: string
          receivable_id: string
        }
        Insert: {
          anticipation_id: string
          created_at?: string
          id?: string
          receivable_id: string
        }
        Update: {
          anticipation_id?: string
          created_at?: string
          id?: string
          receivable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anticipation_receivables_anticipation_id_fkey"
            columns: ["anticipation_id"]
            isOneToOne: false
            referencedRelation: "anticipation_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipation_receivables_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      anticipation_requests: {
        Row: {
          company_id: string
          created_at: string
          id: string
          project_id: string
          quantidade_recebiveis: number
          status: Database["public"]["Enums"]["anticipation_status"]
          tarifa_por_recebivel: number
          taxa_juros_180: number
          taxa_juros_360: number
          taxa_juros_720: number
          taxa_juros_longo_prazo: number
          updated_at: string
          valor_liquido: number
          valor_total: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          project_id: string
          quantidade_recebiveis: number
          status?: Database["public"]["Enums"]["anticipation_status"]
          tarifa_por_recebivel: number
          taxa_juros_180: number
          taxa_juros_360: number
          taxa_juros_720: number
          taxa_juros_longo_prazo: number
          updated_at?: string
          valor_liquido: number
          valor_total: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          project_id?: string
          quantidade_recebiveis?: number
          status?: Database["public"]["Enums"]["anticipation_status"]
          tarifa_por_recebivel?: number
          taxa_juros_180?: number
          taxa_juros_360?: number
          taxa_juros_720?: number
          taxa_juros_longo_prazo?: number
          updated_at?: string
          valor_liquido?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "anticipation_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipation_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_receivables: {
        Row: {
          created_at: string
          id: string
          installment_id: string
          nova_data_vencimento: string | null
          receivable_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          installment_id: string
          nova_data_vencimento?: string | null
          receivable_id: string
        }
        Update: {
          created_at?: string
          id?: string
          installment_id?: string
          nova_data_vencimento?: string | null
          receivable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_receivables_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "payment_plan_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_receivables_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      boletos: {
        Row: {
          arquivo_boleto_name: string | null
          arquivo_boleto_path: string | null
          billing_receivable_id: string
          company_id: string
          created_at: string
          data_emissao: string
          data_vencimento: string
          id: string
          index_id: string | null
          linha_digitavel: string | null
          nosso_numero: string | null
          payer_tax_id: string
          percentual_atualizacao: number | null
          project_id: string
          project_tax_id: string
          status_emissao: Database["public"]["Enums"]["boleto_issuance_status"]
          status_pagamento: Database["public"]["Enums"]["boleto_payment_status"]
          updated_at: string
          valor_boleto: number
          valor_face: number
        }
        Insert: {
          arquivo_boleto_name?: string | null
          arquivo_boleto_path?: string | null
          billing_receivable_id: string
          company_id: string
          created_at?: string
          data_emissao?: string
          data_vencimento: string
          id?: string
          index_id?: string | null
          linha_digitavel?: string | null
          nosso_numero?: string | null
          payer_tax_id: string
          percentual_atualizacao?: number | null
          project_id: string
          project_tax_id: string
          status_emissao?: Database["public"]["Enums"]["boleto_issuance_status"]
          status_pagamento?: Database["public"]["Enums"]["boleto_payment_status"]
          updated_at?: string
          valor_boleto: number
          valor_face: number
        }
        Update: {
          arquivo_boleto_name?: string | null
          arquivo_boleto_path?: string | null
          billing_receivable_id?: string
          company_id?: string
          created_at?: string
          data_emissao?: string
          data_vencimento?: string
          id?: string
          index_id?: string | null
          linha_digitavel?: string | null
          nosso_numero?: string | null
          payer_tax_id?: string
          percentual_atualizacao?: number | null
          project_id?: string
          project_tax_id?: string
          status_emissao?: Database["public"]["Enums"]["boleto_issuance_status"]
          status_pagamento?: Database["public"]["Enums"]["boleto_payment_status"]
          updated_at?: string
          valor_boleto?: number
          valor_face?: number
        }
        Relationships: [
          {
            foreignKeyName: "boletos_billing_receivable_id_fkey"
            columns: ["billing_receivable_id"]
            isOneToOne: false
            referencedRelation: "billing_receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletos_index_id_fkey"
            columns: ["index_id"]
            isOneToOne: false
            referencedRelation: "indexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cnpj: string
          created_at: string
          documents_status: string
          id: string
          name: string
          updated_at: string
          website: string | null
        }
        Insert: {
          cnpj: string
          created_at?: string
          documents_status?: string
          id?: string
          name: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          cnpj?: string
          created_at?: string
          documents_status?: string
          id?: string
          name?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      company_api_credentials: {
        Row: {
          active: boolean
          client_id: string
          client_secret: string
          company_id: string
          created_at: string
          created_by: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_id: string
          client_secret: string
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_id?: string
          client_secret?: string
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_api_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_credit_analysis: {
        Row: {
          available_credit: number | null
          company_id: string
          consumed_credit: number
          created_at: string
          credit_limit: number
          fee_per_receivable: number
          id: string
          interest_rate_180: number
          interest_rate_360: number
          interest_rate_720: number
          interest_rate_long_term: number
          status: string
          updated_at: string
        }
        Insert: {
          available_credit?: number | null
          company_id: string
          consumed_credit?: number
          created_at?: string
          credit_limit: number
          fee_per_receivable: number
          id?: string
          interest_rate_180: number
          interest_rate_360: number
          interest_rate_720: number
          interest_rate_long_term: number
          status: string
          updated_at?: string
        }
        Update: {
          available_credit?: number | null
          company_id?: string
          consumed_credit?: number
          created_at?: string
          credit_limit?: number
          fee_per_receivable?: number
          id?: string
          interest_rate_180?: number
          interest_rate_360?: number
          interest_rate_720?: number
          interest_rate_long_term?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_credit_analysis_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          required: boolean | null
          resource: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          required?: boolean | null
          resource: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          required?: boolean | null
          resource?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          document_type_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          resource_id: string
          resource_type: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["document_status"]
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          document_type_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          resource_id: string
          resource_type: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          document_type_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          resource_id?: string
          resource_type?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      indexes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      indexes_update: {
        Row: {
          created_at: string
          id: string
          index_id: string
          monthly_adjustment: number
          reference_month: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          index_id: string
          monthly_adjustment: number
          reference_month: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          index_id?: string
          monthly_adjustment?: number
          reference_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indexes_update_index_id_fkey"
            columns: ["index_id"]
            isOneToOne: false
            referencedRelation: "indexes"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plan_installments: {
        Row: {
          anticipation_request_id: string
          created_at: string
          data_vencimento: string
          devolucao: number | null
          fundo_reserva: number | null
          id: string
          numero_parcela: number
          payment_plan_settings_id: string
          pmt: number | null
          project_id: string
          recebiveis: number | null
          saldo_devedor: number | null
          updated_at: string
        }
        Insert: {
          anticipation_request_id: string
          created_at?: string
          data_vencimento: string
          devolucao?: number | null
          fundo_reserva?: number | null
          id?: string
          numero_parcela: number
          payment_plan_settings_id: string
          pmt?: number | null
          project_id: string
          recebiveis?: number | null
          saldo_devedor?: number | null
          updated_at?: string
        }
        Update: {
          anticipation_request_id?: string
          created_at?: string
          data_vencimento?: string
          devolucao?: number | null
          fundo_reserva?: number | null
          id?: string
          numero_parcela?: number
          payment_plan_settings_id?: string
          pmt?: number | null
          project_id?: string
          recebiveis?: number | null
          saldo_devedor?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plan_installments_anticipation_request_id_fkey"
            columns: ["anticipation_request_id"]
            isOneToOne: false
            referencedRelation: "anticipation_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_installments_payment_plan_settings_id_fkey"
            columns: ["payment_plan_settings_id"]
            isOneToOne: false
            referencedRelation: "payment_plan_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_installments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plan_settings: {
        Row: {
          adjustment_base_date: string | null
          anticipation_request_id: string
          created_at: string
          dia_cobranca: number
          id: string
          index_id: string | null
          project_id: string
          teto_fundo_reserva: number
          updated_at: string
        }
        Insert: {
          adjustment_base_date?: string | null
          anticipation_request_id: string
          created_at?: string
          dia_cobranca: number
          id?: string
          index_id?: string | null
          project_id: string
          teto_fundo_reserva: number
          updated_at?: string
        }
        Update: {
          adjustment_base_date?: string | null
          anticipation_request_id?: string
          created_at?: string
          dia_cobranca?: number
          id?: string
          index_id?: string | null
          project_id?: string
          teto_fundo_reserva?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plan_settings_anticipation_request_id_fkey"
            columns: ["anticipation_request_id"]
            isOneToOne: false
            referencedRelation: "anticipation_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_settings_index_id_fkey"
            columns: ["index_id"]
            isOneToOne: false
            referencedRelation: "indexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pmt_receivables: {
        Row: {
          created_at: string
          id: string
          installment_id: string
          receivable_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          installment_id: string
          receivable_id: string
        }
        Update: {
          created_at?: string
          id?: string
          installment_id?: string
          receivable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pmt_receivables_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "payment_plan_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmt_receivables_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      project_buyers: {
        Row: {
          buyer_status: Database["public"]["Enums"]["buyer_status"]
          contract_file_name: string | null
          contract_file_path: string | null
          contract_status: Database["public"]["Enums"]["contract_status"]
          cpf: string
          created_at: string
          credit_analysis_status: Database["public"]["Enums"]["credit_analysis_status"]
          full_name: string
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          buyer_status?: Database["public"]["Enums"]["buyer_status"]
          contract_file_name?: string | null
          contract_file_path?: string | null
          contract_status?: Database["public"]["Enums"]["contract_status"]
          cpf: string
          created_at?: string
          credit_analysis_status?: Database["public"]["Enums"]["credit_analysis_status"]
          full_name: string
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          buyer_status?: Database["public"]["Enums"]["buyer_status"]
          contract_file_name?: string | null
          contract_file_path?: string | null
          contract_status?: Database["public"]["Enums"]["contract_status"]
          cpf?: string
          created_at?: string
          credit_analysis_status?: Database["public"]["Enums"]["credit_analysis_status"]
          full_name?: string
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_buyers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          cnpj: string
          company_id: string
          created_at: string
          end_date: string | null
          id: string
          initial_date: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          cnpj: string
          company_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          initial_date: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          cnpj?: string
          company_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          initial_date?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount: number
          buyer_cpf: string
          buyer_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          id: string
          project_id: string
          status: Database["public"]["Enums"]["receivable_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_cpf: string
          buyer_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          project_id: string
          status?: Database["public"]["Enums"]["receivable_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_cpf?: string
          buyer_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["receivable_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_companies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      belongs_to_company: {
        Args: {
          company_id: string
        }
        Returns: boolean
      }
      billing_receivable_has_boleto: {
        Args: {
          p_billing_receivable_id: string
        }
        Returns: boolean
      }
      calculate_anticipation_valor_liquido: {
        Args: {
          p_receivable_ids: string[]
          p_company_id: string
        }
        Returns: number
      }
      calculate_index_adjustment: {
        Args: {
          p_index_id: string
          p_start_date: string
          p_end_date: string
        }
        Returns: number
      }
      calculate_payment_plan_installments: {
        Args: {
          p_payment_plan_settings_id: string
        }
        Returns: undefined
      }
      execute_sql: {
        Args: {
          params: Json
          query_text: string
        }
        Returns: Json
      }
      get_active_credit_analysis_for_company: {
        Args: {
          p_company_id: string
        }
        Returns: Json
      }
      get_anticipation_details: {
        Args: {
          p_anticipation_id: string
        }
        Returns: Json
      }
      get_company_interest_rate: {
        Args: {
          p_company_id: string
          p_days: number
        }
        Returns: number
      }
      get_initial_receivable_status: {
        Args: {
          project_id: string
          buyer_cpf: string
        }
        Returns: Database["public"]["Enums"]["receivable_status"]
      }
      get_project_anticipations: {
        Args: {
          p_company_id: string
          p_project_id?: string
        }
        Returns: Json
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      update_company_documents_status: {
        Args: {
          p_company_id: string
          p_status: string
        }
        Returns: Json
      }
    }
    Enums: {
      anticipation_status: "Solicitada" | "Aprovada" | "Reprovada" | "Concluída"
      boleto_issuance_status: "Criado" | "Emitido" | "Cancelado"
      boleto_payment_status: "N/A" | "Pago" | "Em Aberto" | "Em Atraso"
      buyer_status: "aprovado" | "reprovado" | "a_analisar"
      contract_status: "aprovado" | "reprovado" | "a_enviar" | "a_analisar"
      credit_analysis_status: "aprovado" | "reprovado" | "a_analisar"
      document_status:
        | "sent"
        | "approved"
        | "needs_revision"
        | "not_sent"
        | "rejected"
      project_status: "active" | "inactive"
      receivable_status:
        | "enviado"
        | "elegivel_para_antecipacao"
        | "reprovado"
        | "antecipado"
      user_role: "company_user" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
