export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          firm_name: string | null
          license_number: string | null
          aps_access_token: string | null
          aps_refresh_token: string | null
          aps_token_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          firm_name?: string | null
          license_number?: string | null
          aps_access_token?: string | null
          aps_refresh_token?: string | null
          aps_token_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          firm_name?: string | null
          license_number?: string | null
          aps_access_token?: string | null
          aps_refresh_token?: string | null
          aps_token_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          city: string
          state: string
          project_type: string
          source_type: string
          pdf_storage_path: string | null
          aps_urn: string | null
          aps_hub_id: string | null
          aps_project_id: string | null
          aps_item_id: string | null
          translation_status: string
          translation_started_at: string | null
          original_file_name: string | null
          translation_force_retried: boolean
          translation_force_retried_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          city: string
          state: string
          project_type?: string
          source_type: string
          pdf_storage_path?: string | null
          aps_urn?: string | null
          aps_hub_id?: string | null
          aps_project_id?: string | null
          aps_item_id?: string | null
          translation_status?: string
          translation_started_at?: string | null
          original_file_name?: string | null
          translation_force_retried?: boolean
          translation_force_retried_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          city?: string
          state?: string
          project_type?: string
          source_type?: string
          pdf_storage_path?: string | null
          aps_urn?: string | null
          aps_hub_id?: string | null
          aps_project_id?: string | null
          aps_item_id?: string | null
          translation_status?: string
          translation_started_at?: string | null
          original_file_name?: string | null
          translation_force_retried?: boolean
          translation_force_retried_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      analyses: {
        Row: {
          id: string
          project_id: string
          user_id: string
          status: string
          source_type: string
          city: string
          state: string
          project_type: string
          extracted_properties: Json | null
          violation_count: number
          warning_count: number
          pass_count: number
          claude_model: string | null
          tokens_used: number | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          status?: string
          source_type: string
          city: string
          state: string
          project_type: string
          extracted_properties?: Json | null
          violation_count?: number
          warning_count?: number
          pass_count?: number
          claude_model?: string | null
          tokens_used?: number | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          status?: string
          source_type?: string
          city?: string
          state?: string
          project_type?: string
          extracted_properties?: Json | null
          violation_count?: number
          warning_count?: number
          pass_count?: number
          claude_model?: string | null
          tokens_used?: number | null
          created_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      violations: {
        Row: {
          id: string
          analysis_id: string
          project_id: string
          severity: string
          code_section: string
          code_title: string
          code_requirement: string
          finding: string
          recommendation: string
          element_id: string | null
          element_name: string | null
          element_location: string | null
          measured_value: string | null
          required_value: string | null
          confidence: string
          created_at: string
        }
        Insert: {
          id?: string
          analysis_id: string
          project_id: string
          severity: string
          code_section: string
          code_title: string
          code_requirement: string
          finding: string
          recommendation: string
          element_id?: string | null
          element_name?: string | null
          element_location?: string | null
          measured_value?: string | null
          required_value?: string | null
          confidence?: string
          created_at?: string
        }
        Update: {
          id?: string
          analysis_id?: string
          project_id?: string
          severity?: string
          code_section?: string
          code_title?: string
          code_requirement?: string
          finding?: string
          recommendation?: string
          element_id?: string | null
          element_name?: string | null
          element_location?: string | null
          measured_value?: string | null
          required_value?: string | null
          confidence?: string
          created_at?: string
        }
        Relationships: []
      }
      code_sections: {
        Row: {
          id: string
          jurisdiction: string
          code_year: number
          code_body: string
          section: string
          title: string
          full_text: string
          summary: string
          applies_to: string[]
          is_local_amendment: boolean
          parent_section: string | null
          embedding: number[] | null
          created_at: string
        }
        Insert: {
          id?: string
          jurisdiction: string
          code_year: number
          code_body: string
          section: string
          title: string
          full_text: string
          summary: string
          applies_to?: string[]
          is_local_amendment?: boolean
          parent_section?: string | null
          embedding?: number[] | null
          created_at?: string
        }
        Update: {
          id?: string
          jurisdiction?: string
          code_year?: number
          code_body?: string
          section?: string
          title?: string
          full_text?: string
          summary?: string
          applies_to?: string[]
          is_local_amendment?: boolean
          parent_section?: string | null
          embedding?: number[] | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_code_sections: {
        Args: {
          query_embedding: number[]
          jurisdiction_filter: string
          match_count?: number
        }
        Returns: Array<{
          id: string
          section: string
          title: string
          full_text: string
          code_body: string
          is_local_amendment: boolean
          similarity: number
        }>
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type ViolationRow = Database['public']['Tables']['violations']['Row']
export type AnalysisRow = Database['public']['Tables']['analyses']['Row']
export type ProjectRow = Database['public']['Tables']['projects']['Row']
