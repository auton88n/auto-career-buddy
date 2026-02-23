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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ayn_action_feedback: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          rating: number | null
          session_id: string | null
          strategy_applied: string | null
          success: boolean | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number | null
          session_id?: string | null
          strategy_applied?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number | null
          session_id?: string | null
          strategy_applied?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      ayn_agent_log: {
        Row: {
          agent_name: string | null
          confidence_score: number | null
          created_at: string | null
          id: string
          input_summary: string | null
          output_summary: string | null
          session_id: string | null
          success: boolean | null
        }
        Insert: {
          agent_name?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          session_id?: string | null
          success?: boolean | null
        }
        Update: {
          agent_name?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          session_id?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      ayn_blackboard: {
        Row: {
          key: string
          plan_id: string
          status: string
          step_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          plan_id: string
          status?: string
          step_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          plan_id?: string
          status?: string
          step_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ayn_blackboard_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ayn_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ayn_capabilities: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          examples: Json
          id: string
          input_schema: Json
          key: string
          output_schema: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          enabled?: boolean
          examples?: Json
          id?: string
          input_schema?: Json
          key: string
          output_schema?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          examples?: Json
          id?: string
          input_schema?: Json
          key?: string
          output_schema?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ayn_capability_bindings: {
        Row: {
          auth_profile: string | null
          call_type: string
          capability_key: string
          created_at: string
          endpoint: string
          headers: Json
          id: string
          method: string
          rate_limit_per_min: number
        }
        Insert: {
          auth_profile?: string | null
          call_type: string
          capability_key: string
          created_at?: string
          endpoint: string
          headers?: Json
          id?: string
          method?: string
          rate_limit_per_min?: number
        }
        Update: {
          auth_profile?: string | null
          call_type?: string
          capability_key?: string
          created_at?: string
          endpoint?: string
          headers?: Json
          id?: string
          method?: string
          rate_limit_per_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "ayn_capability_bindings_capability_key_fkey"
            columns: ["capability_key"]
            isOneToOne: false
            referencedRelation: "ayn_capabilities"
            referencedColumns: ["key"]
          },
        ]
      }
      ayn_capability_health: {
        Row: {
          capability_key: string
          checked_at: string
          id: string
          last_error: string | null
          latency_ms: number | null
          status: string
          success_rate: number | null
        }
        Insert: {
          capability_key: string
          checked_at?: string
          id?: string
          last_error?: string | null
          latency_ms?: number | null
          status?: string
          success_rate?: number | null
        }
        Update: {
          capability_key?: string
          checked_at?: string
          id?: string
          last_error?: string | null
          latency_ms?: number | null
          status?: string
          success_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ayn_capability_health_capability_key_fkey"
            columns: ["capability_key"]
            isOneToOne: false
            referencedRelation: "ayn_capabilities"
            referencedColumns: ["key"]
          },
        ]
      }
      ayn_capability_stats: {
        Row: {
          avg_latency_ms: number
          capability_key: string
          id: string
          last_used: string | null
          successes: number
          updated_at: string
          uses: number
        }
        Insert: {
          avg_latency_ms?: number
          capability_key: string
          id?: string
          last_used?: string | null
          successes?: number
          updated_at?: string
          uses?: number
        }
        Update: {
          avg_latency_ms?: number
          capability_key?: string
          id?: string
          last_used?: string | null
          successes?: number
          updated_at?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "ayn_capability_stats_capability_key_fkey"
            columns: ["capability_key"]
            isOneToOne: false
            referencedRelation: "ayn_capabilities"
            referencedColumns: ["key"]
          },
        ]
      }
      ayn_plans: {
        Row: {
          cost_cap_usd: number | null
          created_at: string
          goal: string
          id: string
          plan: Json
          sla_ms: number | null
          user_id: string | null
        }
        Insert: {
          cost_cap_usd?: number | null
          created_at?: string
          goal: string
          id?: string
          plan: Json
          sla_ms?: number | null
          user_id?: string | null
        }
        Update: {
          cost_cap_usd?: number | null
          created_at?: string
          goal?: string
          id?: string
          plan?: Json
          sla_ms?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      ayn_steps: {
        Row: {
          capability_key: string
          finished_at: string | null
          inputs: Json
          plan_id: string
          started_at: string | null
          status: string
          step_id: string
        }
        Insert: {
          capability_key: string
          finished_at?: string | null
          inputs?: Json
          plan_id: string
          started_at?: string | null
          status?: string
          step_id: string
        }
        Update: {
          capability_key?: string
          finished_at?: string | null
          inputs?: Json
          plan_id?: string
          started_at?: string | null
          status?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ayn_steps_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ayn_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ayn_user_memory: {
        Row: {
          agents_used: string[] | null
          conversion_score: number | null
          created_at: string | null
          decision_speed: number | null
          emotion_state: string | null
          id: string
          last_input: string | null
          last_output: string | null
          session_id: string | null
          tags: string[] | null
          tone_preference: string | null
          user_id: string | null
        }
        Insert: {
          agents_used?: string[] | null
          conversion_score?: number | null
          created_at?: string | null
          decision_speed?: number | null
          emotion_state?: string | null
          id?: string
          last_input?: string | null
          last_output?: string | null
          session_id?: string | null
          tags?: string[] | null
          tone_preference?: string | null
          user_id?: string | null
        }
        Update: {
          agents_used?: string[] | null
          conversion_score?: number | null
          created_at?: string | null
          decision_speed?: number | null
          emotion_state?: string | null
          id?: string
          last_input?: string | null
          last_output?: string | null
          session_id?: string | null
          tags?: string[] | null
          tone_preference?: string | null
          user_id?: string | null
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
