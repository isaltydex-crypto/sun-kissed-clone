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
      admin_actions: {
        Row: {
          action: string
          created_at: string
          detail: Json
          id: string
          ip: string | null
          target: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json
          id?: string
          ip?: string | null
          target?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json
          id?: string
          ip?: string | null
          target?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      chat_channels: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          irc_channel_slug: string
          last_message_at: string
          status: string
          visitor_token: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          irc_channel_slug: string
          last_message_at?: string
          status?: string
          visitor_token: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          irc_channel_slug?: string
          last_message_at?: string
          status?: string
          visitor_token?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          channel_id: string
          created_at: string
          id: string
          irc_synced: boolean
          sender: string
          sender_name: string | null
        }
        Insert: {
          body: string
          channel_id: string
          created_at?: string
          id?: string
          irc_synced?: boolean
          sender: string
          sender_name?: string | null
        }
        Update: {
          body?: string
          channel_id?: string
          created_at?: string
          id?: string
          irc_synced?: boolean
          sender?: string
          sender_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_events: {
        Row: {
          created_at: string
          fingerprint: string
          host: string | null
          id: string
          kind: string
          last_seen_at: string
          message: string
          meta: Json
          occurrence_count: number
          resolved: boolean
          resolved_at: string | null
          resolved_note: string | null
          severity: string
          source: string
          stack: string | null
          url: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          fingerprint: string
          host?: string | null
          id?: string
          kind: string
          last_seen_at?: string
          message: string
          meta?: Json
          occurrence_count?: number
          resolved?: boolean
          resolved_at?: string | null
          resolved_note?: string | null
          severity: string
          source: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          fingerprint?: string
          host?: string | null
          id?: string
          kind?: string
          last_seen_at?: string
          message?: string
          meta?: Json
          occurrence_count?: number
          resolved?: boolean
          resolved_at?: string | null
          resolved_note?: string | null
          severity?: string
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          min_subtotal_ore: number | null
          type: string
          updated_at: string
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_subtotal_ore?: number | null
          type: string
          updated_at?: string
          used_count?: number
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_subtotal_ore?: number | null
          type?: string
          updated_at?: string
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total_ore: number
          metadata: Json
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price_ore: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_ore: number
          metadata?: Json
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price_ore: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total_ore?: number
          metadata?: Json
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price_ore?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          discount_ore: number
          fulfillment_status: string
          id: string
          metadata: Json
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_status: string
          shipping_address: Json
          shipping_ore: number
          subtotal_ore: number
          total_ore: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          discount_ore?: number
          fulfillment_status?: string
          id?: string
          metadata?: Json
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: string
          shipping_address?: Json
          shipping_ore?: number
          subtotal_ore: number
          total_ore: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          discount_ore?: number
          fulfillment_status?: string
          id?: string
          metadata?: Json
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: string
          shipping_address?: Json
          shipping_ore?: number
          subtotal_ore?: number
          total_ore?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      site_pages: {
        Row: {
          body: string
          created_at: string
          id: string
          in_menu: boolean
          menu_label: string | null
          menu_order: number
          meta_description: string | null
          published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          in_menu?: boolean
          menu_label?: string | null
          menu_order?: number
          meta_description?: string | null
          published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          in_menu?: boolean
          menu_label?: string | null
          menu_order?: number
          meta_description?: string | null
          published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_diagnostic_event: {
        Args: {
          p_fingerprint: string
          p_host: string
          p_kind: string
          p_message: string
          p_meta: Json
          p_severity: string
          p_source: string
          p_stack: string
          p_url: string
          p_user_agent: string
        }
        Returns: string
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
