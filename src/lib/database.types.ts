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
      activity_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string
          field: string | null
          id: number
          meta: Json | null
          new_value: string | null
          old_value: string | null
          registration_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id: string
          field?: string | null
          id?: never
          meta?: Json | null
          new_value?: string | null
          old_value?: string | null
          registration_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string
          field?: string | null
          id?: never
          meta?: Json | null
          new_value?: string | null
          old_value?: string | null
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      college_access: {
        Row: {
          created_at: string
          invited_by: string | null
          registration_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          registration_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          registration_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "college_access_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
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
          address: string | null
          course: string | null
          created_at: string
          email: string
          id: string
          is_primary: boolean
          matiks_username: string | null
          merch_description: string | null
          merch_sent: boolean
          merch_sent_at: string | null
          name: string
          phone: string | null
          pincode: string | null
          registration_id: string
          role: Database["public"]["Enums"]["contact_role"]
          tshirt_size: Database["public"]["Enums"]["tshirt_size"] | null
          updated_at: string
          year: string | null
        }
        Insert: {
          address?: string | null
          course?: string | null
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean
          matiks_username?: string | null
          merch_description?: string | null
          merch_sent?: boolean
          merch_sent_at?: string | null
          name: string
          phone?: string | null
          pincode?: string | null
          registration_id: string
          role?: Database["public"]["Enums"]["contact_role"]
          tshirt_size?: Database["public"]["Enums"]["tshirt_size"] | null
          updated_at?: string
          year?: string | null
        }
        Update: {
          address?: string | null
          course?: string | null
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean
          matiks_username?: string | null
          merch_description?: string | null
          merch_sent?: boolean
          merch_sent_at?: string | null
          name?: string
          phone?: string | null
          pincode?: string | null
          registration_id?: string
          role?: Database["public"]["Enums"]["contact_role"]
          tshirt_size?: Database["public"]["Enums"]["tshirt_size"] | null
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
          participant_count: number
          poc_email: string
          prize_pool_override: number | null
          referral_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          stage: Database["public"]["Enums"]["registration_stage"]
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
          participant_count?: number
          poc_email: string
          prize_pool_override?: number | null
          referral_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          stage?: Database["public"]["Enums"]["registration_stage"]
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
          participant_count?: number
          poc_email?: string
          prize_pool_override?: number | null
          referral_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          stage?: Database["public"]["Enums"]["registration_stage"]
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
      winners: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          matiks_username: string | null
          merch_description: string | null
          merch_sent: boolean
          merch_sent_at: string | null
          name: string | null
          paid_at: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string | null
          pincode: string | null
          position: string
          prize_amount: number
          prize_type: Database["public"]["Enums"]["prize_type"]
          registration_id: string
          tshirt_size: Database["public"]["Enums"]["tshirt_size"] | null
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          matiks_username?: string | null
          merch_description?: string | null
          merch_sent?: boolean
          merch_sent_at?: string | null
          name?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          pincode?: string | null
          position: string
          prize_amount?: number
          prize_type?: Database["public"]["Enums"]["prize_type"]
          registration_id: string
          tshirt_size?: Database["public"]["Enums"]["tshirt_size"] | null
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          matiks_username?: string | null
          merch_description?: string | null
          merch_sent?: boolean
          merch_sent_at?: string | null
          name?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          pincode?: string | null
          position?: string
          prize_amount?: number
          prize_type?: Database["public"]["Enums"]["prize_type"]
          registration_id?: string
          tshirt_size?: Database["public"]["Enums"]["tshirt_size"] | null
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "winners_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      registration_overview: {
        Row: {
          auto_prize_pool: number | null
          city: string | null
          college_id: string | null
          college_name: string | null
          contacts_merch_sent: number | null
          contacts_total: number | null
          created_at: string | null
          league_id: string | null
          participant_count: number | null
          primary_poc_name: string | null
          prize_paid_amount: number | null
          prize_pool: number | null
          prize_pool_override: number | null
          referral_code: string | null
          registration_id: string | null
          review_status: Database["public"]["Enums"]["registration_status"] | null
          stage: Database["public"]["Enums"]["registration_stage"] | null
          state: string | null
          team_name: string | null
          updated_at: string | null
          utm_source: string | null
          winners_paid: number | null
          winners_total: number | null
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
    Functions: {
      calc_prize_pool: { Args: { p_count: number }; Returns: number }
      find_user_id_by_email: { Args: { p_email: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_admin_writer: { Args: never; Returns: boolean }
      is_non_admin_user: { Args: never; Returns: boolean }
      is_registration_poc: { Args: { reg_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_entity: string
          p_entity_id: string
          p_field: string
          p_meta: Json
          p_new: string
          p_old: string
          p_registration_id: string
        }
        Returns: undefined
      }
      register_college: {
        Args: {
          p_college_city?: string
          p_college_id?: string
          p_college_name?: string
          p_college_state?: string
          p_college_type?: Database["public"]["Enums"]["college_type"]
          p_league_id: string
          p_participants?: Json
          p_poc: Json
          p_referral_code?: string
          p_team_name?: string
          p_utm_campaign?: string
          p_utm_content?: string
          p_utm_medium?: string
          p_utm_source?: string
        }
        Returns: string
      }
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
      payment_status: "pending" | "paid"
      prize_type: "cash" | "cash_plus_merch" | "merch_only"
      registration_stage:
        | "registration_phase"
        | "live"
        | "ended_prize_pending"
        | "ended_prize_sent"
      registration_status: "pending" | "approved" | "waitlisted" | "rejected"
      tshirt_size: "XS" | "S" | "M" | "L" | "XL" | "XXL"
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
      payment_status: ["pending", "paid"],
      prize_type: ["cash", "cash_plus_merch", "merch_only"],
      registration_stage: [
        "registration_phase",
        "live",
        "ended_prize_pending",
        "ended_prize_sent",
      ],
      registration_status: ["pending", "approved", "waitlisted", "rejected"],
      tshirt_size: ["XS", "S", "M", "L", "XL", "XXL"],
    },
  },
} as const
