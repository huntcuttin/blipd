export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          slug: string;
          title: string;
          publisher: string;
          franchise: string | null;
          cover_art: string;
          current_price: number;
          original_price: number;
          discount: number;
          is_on_sale: boolean;
          is_all_time_low: boolean;
          release_date: string;
          release_status: "released" | "upcoming" | "out_today";
          metacritic_score: number | null;
          sale_end_date: string | null;
          price_history: Json;
          nsuid: string | null;
          nintendo_url: string | null;
          last_price_check: string | null;
          switch2_nsuid: string | null;
          upgrade_pack_nsuid: string | null;
          upgrade_pack_price: number | null;
          is_suppressed: boolean;
          release_date_source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          publisher: string;
          franchise?: string | null;
          cover_art: string;
          current_price: number;
          original_price: number;
          discount?: number;
          is_on_sale?: boolean;
          is_all_time_low?: boolean;
          release_date: string;
          release_status?: "released" | "upcoming" | "out_today";
          metacritic_score?: number | null;
          sale_end_date?: string | null;
          price_history?: Json;
          nsuid?: string | null;
          nintendo_url?: string | null;
          last_price_check?: string | null;
          switch2_nsuid?: string | null;
          upgrade_pack_nsuid?: string | null;
          upgrade_pack_price?: number | null;
          is_suppressed?: boolean;
          release_date_source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["games"]["Insert"]>;
        Relationships: [];
      };
      franchises: {
        Row: {
          id: string;
          name: string;
          game_count: number;
          logo: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          game_count: number;
          logo: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["franchises"]["Insert"]>;
        Relationships: [];
      };
      user_game_follows: {
        Row: {
          user_id: string;
          game_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          game_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_game_follows"]["Insert"]>;
        Relationships: [];
      };
      user_franchise_follows: {
        Row: {
          user_id: string;
          franchise_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          franchise_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_franchise_follows"]["Insert"]>;
        Relationships: [];
      };
      alerts: {
        Row: {
          id: string;
          game_id: string;
          type: "price_drop" | "all_time_low" | "out_now" | "sale_started" | "release_today" | "announced" | "switch2_edition_announced";
          headline: string;
          subtext: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          type: string;
          headline: string;
          subtext: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["alerts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "alerts_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      user_profiles: {
        Row: {
          user_id: string;
          console_preference: "switch" | "switch2" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          console_preference?: "switch" | "switch2" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
        Relationships: [];
      };
      user_alert_status: {
        Row: {
          user_id: string;
          alert_id: string;
          read: boolean;
          dismissed: boolean;
          remind_at: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          alert_id: string;
          read?: boolean;
          dismissed?: boolean;
          remind_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_alert_status"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
