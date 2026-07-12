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
      flags: {
        Row: {
          created_at: string
          flag_type: Database["public"]["Enums"]["flag_type"]
          id: string
          invoice_id: string
          reason: string
          related_invoice_id: string | null
        }
        Insert: {
          created_at?: string
          flag_type: Database["public"]["Enums"]["flag_type"]
          id?: string
          invoice_id: string
          reason: string
          related_invoice_id?: string | null
        }
        Update: {
          created_at?: string
          flag_type?: Database["public"]["Enums"]["flag_type"]
          id?: string
          invoice_id?: string
          reason?: string
          related_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flags_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_related_invoice_id_fkey"
            columns: ["related_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          cgst: number | null
          created_at: string
          currency: string
          extraction_confidence: number | null
          file_mime: string | null
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          igst: number | null
          invoice_date: string | null
          invoice_number: string | null
          raw_extraction: Json | null
          sgst: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          total_amount: number | null
          total_tax: number | null
          updated_at: string
          user_id: string
          vendor_gstin: string | null
          vendor_name: string | null
        }
        Insert: {
          cgst?: number | null
          created_at?: string
          currency?: string
          extraction_confidence?: number | null
          file_mime?: string | null
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          igst?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          raw_extraction?: Json | null
          sgst?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          total_amount?: number | null
          total_tax?: number | null
          updated_at?: string
          user_id: string
          vendor_gstin?: string | null
          vendor_name?: string | null
        }
        Update: {
          cgst?: number | null
          created_at?: string
          currency?: string
          extraction_confidence?: number | null
          file_mime?: string | null
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          igst?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          raw_extraction?: Json | null
          sgst?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          total_amount?: number | null
          total_tax?: number | null
          updated_at?: string
          user_id?: string
          vendor_gstin?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      line_items: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          position: number
          quantity: number | null
          tax_rate: number | null
          unit_price: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          position?: number
          quantity?: number | null
          tax_rate?: number | null
          unit_price?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          position?: number
          quantity?: number | null
          tax_rate?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      flag_type:
        | "exact_duplicate"
        | "near_duplicate"
        | "math_mismatch"
        | "vendor_outlier"
        | "possible_duplicate"
        | "calculation_anomaly"
        | "amount_anomaly"
      invoice_status:
        | "uploaded"
        | "extracting"
        | "pending_review"
        | "saved"
        | "flagged"
        | "archived"
        | "clean"
        | "duplicate"
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
      flag_type: [
        "exact_duplicate",
        "near_duplicate",
        "math_mismatch",
        "vendor_outlier",
        "possible_duplicate",
        "calculation_anomaly",
        "amount_anomaly",
      ],
      invoice_status: [
        "uploaded",
        "extracting",
        "pending_review",
        "saved",
        "flagged",
        "archived",
        "clean",
        "duplicate",
      ],
    },
  },
} as const
