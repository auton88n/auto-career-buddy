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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          cover_letter_pdf_url: string | null
          created_at: string
          failure_reason: string | null
          id: string
          job_listing_id: string
          resume_pdf_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_letter_pdf_url?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          job_listing_id: string
          resume_pdf_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_letter_pdf_url?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          job_listing_id?: string
          resume_pdf_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_listing_id_fkey"
            columns: ["job_listing_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_listings: {
        Row: {
          company: string
          created_at: string
          description: string | null
          duplicate_hash: string | null
          id: string
          location: string | null
          salary_info: string | null
          score: number | null
          source: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          description?: string | null
          duplicate_hash?: string | null
          id?: string
          location?: string | null
          salary_info?: string | null
          score?: number | null
          source?: string | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          description?: string | null
          duplicate_hash?: string | null
          id?: string
          location?: string | null
          salary_info?: string | null
          score?: number | null
          source?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profile: {
        Row: {
          created_at: string
          excluded_companies: string[] | null
          experience_level: string | null
          id: string
          industries: string[] | null
          keyword_blacklist: string[] | null
          location_preference: string | null
          max_applications_per_run: number | null
          min_salary: number | null
          notes: string | null
          resume_file_path: string | null
          resume_text: string | null
          skills: string[] | null
          target_locations: string[] | null
          target_titles: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          excluded_companies?: string[] | null
          experience_level?: string | null
          id?: string
          industries?: string[] | null
          keyword_blacklist?: string[] | null
          location_preference?: string | null
          max_applications_per_run?: number | null
          min_salary?: number | null
          notes?: string | null
          resume_file_path?: string | null
          resume_text?: string | null
          skills?: string[] | null
          target_locations?: string[] | null
          target_titles?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          excluded_companies?: string[] | null
          experience_level?: string | null
          id?: string
          industries?: string[] | null
          keyword_blacklist?: string[] | null
          location_preference?: string | null
          max_applications_per_run?: number | null
          min_salary?: number | null
          notes?: string | null
          resume_file_path?: string | null
          resume_text?: string | null
          skills?: string[] | null
          target_locations?: string[] | null
          target_titles?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
