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
      webhook_endpoints: {
        Row: {
          id: string
          created_at: string
          tag: string
          description: string | null
          url_path: string
        }
        Insert: {
          id?: string
          created_at?: string
          tag: string
          description?: string | null
          url_path?: string
        }
        Update: {
          id?: string
          created_at?: string
          tag?: string
          description?: string | null
          url_path?: string
        }
        Relationships: []
      }
      // ... existing code ...
    }
  }
} 