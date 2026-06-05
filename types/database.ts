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
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
