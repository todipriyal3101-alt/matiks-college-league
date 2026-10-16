// HAND-WRITTEN from supabase/migrations/*.sql in the `supabase gen types typescript` format.
// The Supabase CLI is not linked on this machine. Update this file in the same change
// as any migration that alters tables, enums or functions.

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
      admin_profiles: {
        Row: {
          created_at: string
          email: string
          name: string | null
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          name?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          name?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ambassadors: {
        Row: {
          active: boolean
          college_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          referral_code: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          college_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          referral_code: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          college_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          referral_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassadors_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      colleges: {
        Row: {
          city: string | null
          college_type: Database["public"]["Enums"]["college_type"]
          created_at: string
          id: string
          logo_url: string | null
          name: string
          normalized_name: string | null
          short_name: string | null
          state: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          college_type?: Database["public"]["Enums"]["college_type"]
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          short_name?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          college_type?: Database["public"]["Enums"]["college_type"]
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          short_name?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          course: string | null
          created_at: string
          email: string
          id: string
          matiks_username: string | null
          name: string
          phone: string | null
          registration_id: string
          role: Database["public"]["Enums"]["contact_role"]
          updated_at: string
          year: string | null
        }
        Insert: {
          course?: string | null
          created_at?: string
          email: string
          id?: string
          matiks_username?: string | null
          name: string
          phone?: string | null
          registration_id: string
          role?: Database["public"]["Enums"]["contact_role"]
          updated_at?: string
          year?: string | null
        }
        Update: {
          course?: string | null
          created_at?: string
          email?: string
          id?: string
          matiks_username?: string | null
          name?: string
          phone?: string | null
          registration_id?: string
          role?: Database["public"]["Enums"]["contact_role"]
          updated_at?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          max_colleges: number | null
          name: string
          registration_deadline: string | null
          registration_open: boolean
          season: number
          slug: string
          start_date: string | null
          status: Database["public"]["Enums"]["league_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          max_colleges?: number | null
          name: string
          registration_deadline?: string | null
          registration_open?: boolean
          season: number
          slug: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["league_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          max_colleges?: number | null
          name?: string
          registration_deadline?: string | null
          registration_open?: boolean
          season?: number
          slug?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["league_status"]
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          college_a_id: string
          college_b_id: string
          created_at: string
          id: string
          league_id: string
          round: string
          scheduled_at: string | null
          score_a: number | null
          score_b: number | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          college_a_id: string
          college_b_id: string
          created_at?: string
          id?: string
          league_id: string
          round: string
          scheduled_at?: string | null
          score_a?: number | null
          score_b?: number | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          college_a_id?: string
          college_b_id?: string
          created_at?: string
          id?: string
          league_id?: string
          round?: string
          scheduled_at?: string | null
          score_a?: number | null
          score_b?: number | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_college_a_id_fkey"
            columns: ["college_a_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_college_b_id_fkey"
            columns: ["college_b_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          created_at: string
          email: string | null
          id: string
          matiks_username: string
          name: string
          registration_id: string
          updated_at: string
          year: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          matiks_username: string
          name: string
          registration_id: string
          updated_at?: string
          year?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          matiks_username?: string
          name?: string
          registration_id?: string
          updated_at?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          admin_notes: string | null
          college_id: string
          created_at: string
          id: string
          league_id: string
          poc_email: string
          referral_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["registration_status"]
          team_name: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          admin_notes?: string | null
          college_id: string
          created_at?: string
          id?: string
          league_id: string
          poc_email: string
          referral_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          team_name?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          admin_notes?: string | null
          college_id?: string
          created_at?: string
          id?: string
          league_id?: string
          poc_email?: string
          referral_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          team_name?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_admin_writer: { Args: never; Returns: boolean }
      is_registration_poc: { Args: { reg_id: string }; Returns: boolean }
    }
    Enums: {
      admin_role: "admin" | "viewer"
      college_type:
        | "iit"
        | "nit"
        | "iiit"
        | "bits"
        | "government"
        | "private"
        | "other"
      contact_role: "poc" | "captain" | "faculty"
      league_status: "draft" | "upcoming" | "live" | "completed"
      registration_status: "pending" | "approved" | "waitlisted" | "rejected"
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

export const Constants = {
  public: {
    Enums: {
      admin_role: ["admin", "viewer"],
      college_type: [
        "iit",
        "nit",
        "iiit",
        "bits",
        "government",
        "private",
        "other",
      ],
      contact_role: ["poc", "captain", "faculty"],
      league_status: ["draft", "upcoming", "live", "completed"],
      registration_status: ["pending", "approved", "waitlisted", "rejected"],
    },
  },
} as const
