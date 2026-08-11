export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          details: Json;
          id: number;
          target_id: string | null;
          target_type: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: never;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: never;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      announcements: {
        Row: {
          created_at: string;
          created_by: string;
          ends_at: string | null;
          id: number;
          is_active: boolean;
          message: string;
          severity: string;
          starts_at: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          ends_at?: string | null;
          id?: never;
          is_active?: boolean;
          message: string;
          severity?: string;
          starts_at?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          ends_at?: string | null;
          id?: never;
          is_active?: boolean;
          message?: string;
          severity?: string;
          starts_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      categories: {
        Row: {
          color: string;
          created_at: string;
          icon_key: string;
          id: number;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          color?: string;
          created_at?: string;
          icon_key: string;
          id?: never;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          color?: string;
          created_at?: string;
          icon_key?: string;
          id?: never;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      market_price_history: {
        Row: {
          created_at: string;
          id: number;
          market_id: number;
          probability_yes: number;
          total_volume: number;
          trade_id: number;
        };
        Insert: {
          created_at?: string;
          id?: never;
          market_id: number;
          probability_yes: number;
          total_volume: number;
          trade_id: number;
        };
        Update: {
          created_at?: string;
          id?: never;
          market_id?: number;
          probability_yes?: number;
          total_volume?: number;
          trade_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "market_price_history_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_price_history_trade_id_fkey";
            columns: ["trade_id"];
            isOneToOne: true;
            referencedRelation: "trades";
            referencedColumns: ["id"];
          },
        ];
      };
      market_settlements: {
        Row: {
          id: number;
          market_id: number;
          payout: number;
          settled_at: string;
          user_id: string;
          wallet_transaction_id: number | null;
          winning_outcome: string;
          winning_shares: number;
        };
        Insert: {
          id?: never;
          market_id: number;
          payout: number;
          settled_at?: string;
          user_id: string;
          wallet_transaction_id?: number | null;
          winning_outcome: string;
          winning_shares: number;
        };
        Update: {
          id?: never;
          market_id?: number;
          payout?: number;
          settled_at?: string;
          user_id?: string;
          wallet_transaction_id?: number | null;
          winning_outcome?: string;
          winning_shares?: number;
        };
        Relationships: [
          {
            foreignKeyName: "market_settlements_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_settlements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "market_settlements_wallet_transaction_id_fkey";
            columns: ["wallet_transaction_id"];
            isOneToOne: true;
            referencedRelation: "wallet_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      markets: {
        Row: {
          category_id: number;
          closes_at: string;
          created_at: string;
          created_by: string;
          description: string | null;
          id: number;
          opens_at: string;
          pool_no: number;
          pool_yes: number;
          question: string;
          resolution_criteria: string;
          resolution_source_url: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          resolved_outcome: string | null;
          status: string;
          total_volume: number;
          updated_at: string;
        };
        Insert: {
          category_id: number;
          closes_at: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: never;
          opens_at: string;
          pool_no?: number;
          pool_yes?: number;
          question: string;
          resolution_criteria: string;
          resolution_source_url?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolved_outcome?: string | null;
          status?: string;
          total_volume?: number;
          updated_at?: string;
        };
        Update: {
          category_id?: number;
          closes_at?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: never;
          opens_at?: string;
          pool_no?: number;
          pool_yes?: number;
          question?: string;
          resolution_criteria?: string;
          resolution_source_url?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolved_outcome?: string | null;
          status?: string;
          total_volume?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "markets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "markets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "markets_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      positions: {
        Row: {
          market_id: number;
          no_shares: number;
          total_invested: number;
          updated_at: string;
          user_id: string;
          yes_shares: number;
        };
        Insert: {
          market_id: number;
          no_shares?: number;
          total_invested?: number;
          updated_at?: string;
          user_id: string;
          yes_shares?: number;
        };
        Update: {
          market_id?: number;
          no_shares?: number;
          total_invested?: number;
          updated_at?: string;
          user_id?: string;
          yes_shares?: number;
        };
        Relationships: [
          {
            foreignKeyName: "positions_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "positions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      profiles: {
        Row: {
          account_status: string;
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          graduation_year: number | null;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_status?: string;
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          graduation_year?: number | null;
          role?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_status?: string;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          graduation_year?: number | null;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      trades: {
        Row: {
          average_price: number;
          created_at: string;
          id: number;
          market_id: number;
          outcome: string;
          pool_no_after: number;
          pool_no_before: number;
          pool_yes_after: number;
          pool_yes_before: number;
          price_impact: number;
          probability_after: number;
          probability_before: number;
          shares_received: number;
          token_amount: number;
          user_id: string;
          wallet_transaction_id: number;
        };
        Insert: {
          average_price: number;
          created_at?: string;
          id?: never;
          market_id: number;
          outcome: string;
          pool_no_after: number;
          pool_no_before: number;
          pool_yes_after: number;
          pool_yes_before: number;
          price_impact: number;
          probability_after: number;
          probability_before: number;
          shares_received: number;
          token_amount: number;
          user_id: string;
          wallet_transaction_id: number;
        };
        Update: {
          average_price?: number;
          created_at?: string;
          id?: never;
          market_id?: number;
          outcome?: string;
          pool_no_after?: number;
          pool_no_before?: number;
          pool_yes_after?: number;
          pool_yes_before?: number;
          price_impact?: number;
          probability_after?: number;
          probability_before?: number;
          shares_received?: number;
          token_amount?: number;
          user_id?: string;
          wallet_transaction_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "trades_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trades_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "trades_wallet_transaction_id_fkey";
            columns: ["wallet_transaction_id"];
            isOneToOne: true;
            referencedRelation: "wallet_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      wallet_transactions: {
        Row: {
          amount: number;
          balance_after: number;
          created_at: string;
          id: number;
          idempotency_key: string | null;
          market_id: number | null;
          note: string | null;
          transaction_type: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          balance_after: number;
          created_at?: string;
          id?: never;
          idempotency_key?: string | null;
          market_id?: number | null;
          note?: string | null;
          transaction_type: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          balance_after?: number;
          created_at?: string;
          id?: never;
          idempotency_key?: string | null;
          market_id?: number | null;
          note?: string | null;
          transaction_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["user_id"];
          },
        ];
      };
      wallets: {
        Row: {
          balance: number;
          lifetime_earned: number;
          lifetime_spent: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          lifetime_earned?: number;
          lifetime_spent?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          lifetime_earned?: number;
          lifetime_spent?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      watchlists: {
        Row: {
          created_at: string;
          market_id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          market_id: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          market_id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watchlists_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "watchlists_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_create_announcement: {
        Args: {
          p_ends_at?: string | null;
          p_message: string;
          p_severity?: string;
        };
        Returns: number;
      };
      admin_create_market: {
        Args: {
          p_category_id: number;
          p_closes_at: string;
          p_description: string;
          p_initial_liquidity?: number;
          p_opens_at: string;
          p_question: string;
          p_resolution_criteria: string;
          p_resolution_source_url: string;
          p_status?: string;
        };
        Returns: number;
      };
      admin_delete_announcement: {
        Args: {
          p_id: number;
        };
        Returns: undefined;
      };
      admin_list_announcements: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          ends_at: string | null;
          id: number;
          is_active: boolean;
          is_live: boolean;
          message: string;
          severity: string;
          starts_at: string;
          updated_at: string;
        }[];
      };
      admin_update_announcement: {
        Args: {
          p_ends_at?: string | null;
          p_id: number;
          p_is_active: boolean;
          p_message: string;
          p_severity: string;
        };
        Returns: undefined;
      };
      admin_list_markets: {
        Args: Record<PropertyKey, never>;
        Returns: {
          category_color: string;
          category_id: number;
          category_name: string;
          closes_at: string;
          created_at: string;
          description: string | null;
          id: number;
          opens_at: string;
          pool_no: number;
          pool_yes: number;
          position_count: number;
          question: string;
          resolution_criteria: string;
          resolution_source_url: string | null;
          resolved_outcome: string | null;
          status: string;
          total_volume: number;
          trade_count: number;
        }[];
      };
      admin_resolve_market: {
        Args: {
          p_market_id: number;
          p_outcome: string;
          p_resolution_note?: string;
        };
        Returns: {
          settled_positions: number;
          total_payout: number;
        }[];
      };
      admin_set_market_status: {
        Args: {
          p_market_id: number;
          p_status: string;
        };
        Returns: string;
      };
      execute_trade: {
        Args: {
          p_market_id: number;
          p_outcome: string;
          p_token_amount: number;
        };
        Returns: {
          balance: number;
          market_id: number;
          probability_no: number;
          probability_yes: number;
          shares_received: number;
          total_volume: number;
          trade_id: number;
        }[];
      };
      get_rankings: {
        Args: {
          result_limit?: number;
        };
        Returns: {
          display_name: string;
          graduation_year: number | null;
          is_current_user: boolean;
          open_positions: number;
          portfolio_value: number;
          rank: number;
          resolved_picks: number;
          total_picks: number;
          wins: number;
        }[];
      };
      submit_trade: {
        Args: {
          p_idempotency_key: string;
          p_market_id: number;
          p_outcome: string;
          p_token_amount: number;
        };
        Returns: {
          balance: number;
          market_id: number;
          pool_no: number;
          pool_yes: number;
          probability_no: number;
          probability_yes: number;
          shares_received: number;
          total_volume: number;
          trade_id: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
