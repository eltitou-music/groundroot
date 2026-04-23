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
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          set_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          set_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sets: {
        Row: {
          cover_image_url: string | null
          created_at: string
          id: string
          ideal_arc: string | null
          intention: string | null
          occasion: string | null
          title: string
          updated_at: string
          user_id: string
          vision_notes: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          ideal_arc?: string | null
          intention?: string | null
          occasion?: string | null
          title?: string
          updated_at?: string
          user_id: string
          vision_notes?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          ideal_arc?: string | null
          intention?: string | null
          occasion?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          vision_notes?: string | null
        }
        Relationships: []
      }
      sound_effects: {
        Row: {
          created_at: string
          drive_file_id: string | null
          from_track_id: string
          id: string
          label: string
          set_id: string
          source: Database["public"]["Enums"]["track_source"]
          to_track_id: string
          upload_url: string | null
        }
        Insert: {
          created_at?: string
          drive_file_id?: string | null
          from_track_id: string
          id?: string
          label: string
          set_id: string
          source: Database["public"]["Enums"]["track_source"]
          to_track_id: string
          upload_url?: string | null
        }
        Update: {
          created_at?: string
          drive_file_id?: string | null
          from_track_id?: string
          id?: string
          label?: string
          set_id?: string
          source?: Database["public"]["Enums"]["track_source"]
          to_track_id?: string
          upload_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sound_effects_from_track_id_fkey"
            columns: ["from_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sound_effects_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sound_effects_to_track_id_fkey"
            columns: ["to_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          artist: string | null
          bpm: number | null
          camelot_key: string | null
          created_at: string
          cue_in: number | null
          cue_out: number | null
          danceability: number | null
          drive_file_id: string | null
          duration_seconds: number | null
          energy: number | null
          id: string
          notes: string | null
          position: number
          set_id: string
          source: Database["public"]["Enums"]["track_source"]
          spotify_track_id: string | null
          title: string
          updated_at: string
          upload_url: string | null
          valence: number | null
        }
        Insert: {
          artist?: string | null
          bpm?: number | null
          camelot_key?: string | null
          created_at?: string
          cue_in?: number | null
          cue_out?: number | null
          danceability?: number | null
          drive_file_id?: string | null
          duration_seconds?: number | null
          energy?: number | null
          id?: string
          notes?: string | null
          position?: number
          set_id: string
          source: Database["public"]["Enums"]["track_source"]
          spotify_track_id?: string | null
          title: string
          updated_at?: string
          upload_url?: string | null
          valence?: number | null
        }
        Update: {
          artist?: string | null
          bpm?: number | null
          camelot_key?: string | null
          created_at?: string
          cue_in?: number | null
          cue_out?: number | null
          danceability?: number | null
          drive_file_id?: string | null
          duration_seconds?: number | null
          energy?: number | null
          id?: string
          notes?: string | null
          position?: number
          set_id?: string
          source?: Database["public"]["Enums"]["track_source"]
          spotify_track_id?: string | null
          title?: string
          updated_at?: string
          upload_url?: string | null
          valence?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tracks_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
        ]
      }
      transition_notes: {
        Row: {
          created_at: string
          from_track_id: string
          id: string
          note: string | null
          quality: string | null
          set_id: string
          to_track_id: string
        }
        Insert: {
          created_at?: string
          from_track_id: string
          id?: string
          note?: string | null
          quality?: string | null
          set_id: string
          to_track_id: string
        }
        Update: {
          created_at?: string
          from_track_id?: string
          id?: string
          note?: string | null
          quality?: string | null
          set_id?: string
          to_track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transition_notes_from_track_id_fkey"
            columns: ["from_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transition_notes_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transition_notes_to_track_id_fkey"
            columns: ["to_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
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
      track_source: "spotify" | "drive" | "upload" | "manual"
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
      track_source: ["spotify", "drive", "upload", "manual"],
    },
  },
} as const
