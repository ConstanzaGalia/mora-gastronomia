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
      business_spaces: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_spaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_days: {
        Row: {
          business_space_id: string
          calendar_week_id: string
          created_at: string
          id: string
          is_service_day: boolean
          notes: string | null
          service_date: string
          updated_at: string
        }
        Insert: {
          business_space_id: string
          calendar_week_id: string
          created_at?: string
          id?: string
          is_service_day?: boolean
          notes?: string | null
          service_date: string
          updated_at?: string
        }
        Update: {
          business_space_id?: string
          calendar_week_id?: string
          created_at?: string
          id?: string
          is_service_day?: boolean
          notes?: string | null
          service_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_days_week_fkey"
            columns: ["calendar_week_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "calendar_weeks"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      calendar_weeks: {
        Row: {
          business_space_id: string
          created_at: string
          id: string
          notes: string | null
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["calendar_week_status"]
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          business_space_id: string
          created_at?: string
          id?: string
          notes?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["calendar_week_status"]
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          business_space_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["calendar_week_status"]
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_weeks_business_space_id_fkey"
            columns: ["business_space_id"]
            isOneToOne: false
            referencedRelation: "business_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_weeks_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean
          business_space_id: string
          created_at: string
          cuit: string | null
          id: string
          nombre_comercial: string
          razon_social: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_space_id: string
          created_at?: string
          cuit?: string | null
          id?: string
          nombre_comercial: string
          razon_social?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_space_id?: string
          created_at?: string
          cuit?: string | null
          id?: string
          nombre_comercial?: string
          razon_social?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_business_space_id_fkey"
            columns: ["business_space_id"]
            isOneToOne: false
            referencedRelation: "business_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_charges: {
        Row: {
          amount: number
          business_space_id: string
          charged_on: string
          company_id: string
          concept: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          amount: number
          business_space_id: string
          charged_on: string
          company_id: string
          concept: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_space_id?: string
          charged_on?: string
          company_id?: string
          concept?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_charges_company_space_fkey"
            columns: ["company_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      company_day_extras: {
        Row: {
          business_space_id: string
          calendar_day_id: string
          category_id: string
          company_id: string
          created_at: string
          id: string
          option_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          business_space_id: string
          calendar_day_id: string
          category_id: string
          company_id: string
          created_at?: string
          id?: string
          option_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          business_space_id?: string
          calendar_day_id?: string
          category_id?: string
          company_id?: string
          created_at?: string
          id?: string
          option_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      day_company_extensions: {
        Row: {
          business_space_id: string
          calendar_day_id: string
          company_id: string
          created_at: string
        }
        Insert: {
          business_space_id: string
          calendar_day_id: string
          company_id: string
          created_at?: string
        }
        Update: {
          business_space_id?: string
          calendar_day_id?: string
          company_id?: string
          created_at?: string
        }
        Relationships: []
      }
      document_categories: {
        Row: {
          business_space_id: string
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          business_space_id: string
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          business_space_id?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_categories_business_space_id_fkey"
            columns: ["business_space_id"]
            isOneToOne: false
            referencedRelation: "business_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_hour_entries: {
        Row: {
          business_space_id: string
          company_id: string
          created_at: string
          hours: number
          id: string
          note: string | null
          updated_at: string
          worked_on: string
        }
        Insert: {
          business_space_id: string
          company_id: string
          created_at?: string
          hours: number
          id?: string
          note?: string | null
          updated_at?: string
          worked_on: string
        }
        Update: {
          business_space_id?: string
          company_id?: string
          created_at?: string
          hours?: number
          id?: string
          note?: string | null
          updated_at?: string
          worked_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_hour_entries_company_space_fkey"
            columns: ["company_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      company_hour_prices: {
        Row: {
          business_space_id: string
          company_id: string
          created_at: string
          effective_from: string
          id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          business_space_id: string
          company_id: string
          created_at?: string
          effective_from: string
          id?: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          business_space_id?: string
          company_id?: string
          created_at?: string
          effective_from?: string
          id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_hour_prices_company_space_fkey"
            columns: ["company_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      company_payments: {
        Row: {
          amount: number
          business_space_id: string
          company_id: string
          created_at: string
          id: string
          note: string | null
          paid_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          business_space_id: string
          company_id: string
          created_at?: string
          id?: string
          note?: string | null
          paid_on: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_space_id?: string
          company_id?: string
          created_at?: string
          id?: string
          note?: string | null
          paid_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_payments_company_space_fkey"
            columns: ["company_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      company_sectors: {
        Row: {
          business_space_id: string
          company_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_space_id: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_space_id?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_sectors_company_space_fkey"
            columns: ["company_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      company_tray_prices: {
        Row: {
          business_space_id: string
          company_id: string
          created_at: string
          effective_from: string
          id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          business_space_id: string
          company_id: string
          created_at?: string
          effective_from: string
          id?: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          business_space_id?: string
          company_id?: string
          created_at?: string
          effective_from?: string
          id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_tray_prices_company_space_fkey"
            columns: ["company_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      company_gastronomic_categories: {
        Row: {
          active: boolean
          business_space_id: string
          category_id: string
          company_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_space_id: string
          category_id: string
          company_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_space_id?: string
          category_id?: string
          company_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cgc_category_space_fkey"
            columns: ["category_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_categories"
            referencedColumns: ["id", "business_space_id"]
          },
          {
            foreignKeyName: "cgc_company_space_fkey"
            columns: ["company_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      daily_availability: {
        Row: {
          business_space_id: string
          calendar_day_id: string
          category_id: string
          created_at: string
          id: string
          option_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_space_id: string
          calendar_day_id: string
          category_id: string
          created_at?: string
          id?: string
          option_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_space_id?: string
          calendar_day_id?: string
          category_id?: string
          created_at?: string
          id?: string
          option_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_availability_category_fkey"
            columns: ["category_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_categories"
            referencedColumns: ["id", "business_space_id"]
          },
          {
            foreignKeyName: "daily_availability_day_fkey"
            columns: ["calendar_day_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "calendar_days"
            referencedColumns: ["id", "business_space_id"]
          },
          {
            foreignKeyName: "daily_availability_option_fkey"
            columns: ["option_id", "category_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_options"
            referencedColumns: ["id", "category_id"]
          },
        ]
      }
      employee_selection_items: {
        Row: {
          category_id: string
          created_at: string
          id: string
          option_id: string
          selection_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          option_id: string
          selection_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          option_id?: string
          selection_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_selection_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_selection_items_option_fkey"
            columns: ["option_id", "category_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_options"
            referencedColumns: ["id", "category_id"]
          },
          {
            foreignKeyName: "employee_selection_items_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "employee_selections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_selection_items_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "v_selection_details"
            referencedColumns: ["selection_id"]
          },
        ]
      }
      employee_selections: {
        Row: {
          business_space_id: string
          calendar_day_id: string
          cancelled_at: string | null
          company_id: string
          created_at: string
          employee_id: string
          id: string
          locked_at: string
          membership_id: string
          service_date: string
          status: Database["public"]["Enums"]["selection_status"]
          submitted_at: string
          updated_at: string
        }
        Insert: {
          business_space_id: string
          calendar_day_id: string
          cancelled_at?: string | null
          company_id: string
          created_at?: string
          employee_id: string
          id?: string
          locked_at: string
          membership_id: string
          service_date: string
          status?: Database["public"]["Enums"]["selection_status"]
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          business_space_id?: string
          calendar_day_id?: string
          cancelled_at?: string | null
          company_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          locked_at?: string
          membership_id?: string
          service_date?: string
          status?: Database["public"]["Enums"]["selection_status"]
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_selections_company_fkey"
            columns: ["company_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "business_space_id"]
          },
          {
            foreignKeyName: "employee_selections_day_fkey"
            columns: ["calendar_day_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "calendar_days"
            referencedColumns: ["id", "business_space_id"]
          },
          {
            foreignKeyName: "employee_selections_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_selections_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      event_expenses: {
        Row: {
          amount: number
          business_space_id: string
          concept: string
          created_at: string
          event_id: string
          id: string
          spent_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          business_space_id: string
          concept: string
          created_at?: string
          event_id: string
          id?: string
          spent_on: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_space_id?: string
          concept?: string
          created_at?: string
          event_id?: string
          id?: string
          spent_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_expenses_event_space_fkey"
            columns: ["event_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      event_items: {
        Row: {
          business_space_id: string
          created_at: string
          event_id: string
          id: string
          name: string
          notes: string | null
          quantity: number
          sort_order: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          business_space_id: string
          created_at?: string
          event_id: string
          id?: string
          name: string
          notes?: string | null
          quantity: number
          sort_order?: number
          unit_cost: number
          updated_at?: string
        }
        Update: {
          business_space_id?: string
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          sort_order?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_items_event_space_fkey"
            columns: ["event_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      event_payments: {
        Row: {
          amount: number
          business_space_id: string
          created_at: string
          event_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          business_space_id: string
          created_at?: string
          event_id: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_on: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_space_id?: string
          created_at?: string
          event_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_payments_event_space_fkey"
            columns: ["event_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      events: {
        Row: {
          business_space_id: string
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          event_on: string
          event_time: string | null
          guest_count: number | null
          id: string
          name: string
          notes: string | null
          quoted_amount: number
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
          venue: string | null
        }
        Insert: {
          business_space_id: string
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          event_on: string
          event_time?: string | null
          guest_count?: number | null
          id?: string
          name: string
          notes?: string | null
          quoted_amount: number
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue?: string | null
        }
        Update: {
          business_space_id?: string
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          event_on?: string
          event_time?: string | null
          guest_count?: number | null
          id?: string
          name?: string
          notes?: string | null
          quoted_amount?: number
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_business_space_id_fkey"
            columns: ["business_space_id"]
            isOneToOne: false
            referencedRelation: "business_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gastronomic_categories: {
        Row: {
          active: boolean
          business_space_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_space_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_space_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastronomic_categories_business_space_id_fkey"
            columns: ["business_space_id"]
            isOneToOne: false
            referencedRelation: "business_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gastronomic_options: {
        Row: {
          active: boolean
          category_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastronomic_options_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          business_space_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          notes: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          sector_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          business_space_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          sector_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          business_space_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          sector_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_company_space_fkey"
            columns: ["company_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "business_space_id"]
          },
          {
            foreignKeyName: "memberships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "company_sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_space_org_fkey"
            columns: ["business_space_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_spaces"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_order_items: {
        Row: {
          amount: number
          business_space_id: string
          category_name: string
          created_at: string
          id: string
          option_id: string | null
          option_name: string
          order_id: string
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          amount: number
          business_space_id: string
          category_name: string
          created_at?: string
          id?: string
          option_id?: string | null
          option_name: string
          order_id: string
          quantity: number
          sort_order?: number
          unit_price: number
        }
        Update: {
          amount?: number
          business_space_id?: string
          category_name?: string
          created_at?: string
          id?: string
          option_id?: string | null
          option_name?: string
          order_id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_order_items_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_order_items_order_space_fkey"
            columns: ["order_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "market_orders"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      market_orders: {
        Row: {
          address: string
          business_space_id: string
          created_at: string
          customer_name: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          after_cutoff: boolean
          paid: boolean
          phone: string
          service_date: string
          status: Database["public"]["Enums"]["market_order_status"]
          total: number
          updated_at: string
        }
        Insert: {
          address: string
          after_cutoff?: boolean
          business_space_id: string
          created_at?: string
          customer_name: string
          id?: string
          notes?: string | null
          paid?: boolean
          payment_method: Database["public"]["Enums"]["payment_method"]
          phone: string
          service_date: string
          status?: Database["public"]["Enums"]["market_order_status"]
          total: number
          updated_at?: string
        }
        Update: {
          address?: string
          after_cutoff?: boolean
          business_space_id?: string
          created_at?: string
          customer_name?: string
          id?: string
          notes?: string | null
          paid?: boolean
          payment_method?: Database["public"]["Enums"]["payment_method"]
          phone?: string
          service_date?: string
          status?: Database["public"]["Enums"]["market_order_status"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_orders_business_space_id_fkey"
            columns: ["business_space_id"]
            isOneToOne: false
            referencedRelation: "business_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      market_settings: {
        Row: {
          business_space_id: string
          created_at: string
          delivery_note: string | null
          enabled: boolean
          transfer_alias: string | null
          transfer_bank: string | null
          transfer_cbu: string | null
          transfer_holder: string | null
          unit_price: number | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          business_space_id: string
          created_at?: string
          delivery_note?: string | null
          enabled?: boolean
          transfer_alias?: string | null
          transfer_bank?: string | null
          transfer_cbu?: string | null
          transfer_holder?: string | null
          unit_price?: number | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          business_space_id?: string
          created_at?: string
          delivery_note?: string | null
          enabled?: boolean
          transfer_alias?: string | null
          transfer_bank?: string | null
          transfer_cbu?: string | null
          transfer_holder?: string | null
          unit_price?: number | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_settings_business_space_id_fkey"
            columns: ["business_space_id"]
            isOneToOne: true
            referencedRelation: "business_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          apellido: string
          created_at: string
          dni: string
          email: string | null
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          apellido: string
          created_at?: string
          dni: string
          email?: string | null
          id: string
          nombre: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          apellido?: string
          created_at?: string
          dni?: string
          email?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean
          business_space_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_space_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_space_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_business_space_id_fkey"
            columns: ["business_space_id"]
            isOneToOne: false
            referencedRelation: "business_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          business_space_id: string
          concept: string
          created_at: string
          echeq_date: string | null
          echeq_number: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_on: string
          status: Database["public"]["Enums"]["payment_status"]
          supplier_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          business_space_id: string
          concept: string
          created_at?: string
          echeq_date?: string | null
          echeq_number?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_on: string
          status?: Database["public"]["Enums"]["payment_status"]
          supplier_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_space_id?: string
          concept?: string
          created_at?: string
          echeq_date?: string | null
          echeq_number?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_on?: string
          status?: Database["public"]["Enums"]["payment_status"]
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_space_fkey"
            columns: ["supplier_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      fixed_expenses: {
        Row: {
          active: boolean
          business_space_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_space_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_space_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expenses_business_space_id_fkey"
            columns: ["business_space_id"]
            isOneToOne: false
            referencedRelation: "business_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_expense_months: {
        Row: {
          amount: number | null
          business_space_id: string
          created_at: string
          fixed_expense_id: string
          id: string
          month: number
          status: Database["public"]["Enums"]["fixed_month_status"]
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number | null
          business_space_id: string
          created_at?: string
          fixed_expense_id: string
          id?: string
          month: number
          status: Database["public"]["Enums"]["fixed_month_status"]
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number | null
          business_space_id?: string
          created_at?: string
          fixed_expense_id?: string
          id?: string
          month?: number
          status?: Database["public"]["Enums"]["fixed_month_status"]
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expense_months_expense_space_fkey"
            columns: ["fixed_expense_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "fixed_expenses"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      space_documents: {
        Row: {
          business_space_id: string
          category_id: string
          created_at: string
          created_by: string | null
          expires_on: string | null
          file_size: number
          id: string
          issued_on: string | null
          mime_type: string
          original_name: string
          storage_path: string
          title: string
          updated_at: string
        }
        Insert: {
          business_space_id: string
          category_id: string
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          file_size: number
          id?: string
          issued_on?: string | null
          mime_type: string
          original_name: string
          storage_path: string
          title: string
          updated_at?: string
        }
        Update: {
          business_space_id?: string
          category_id?: string
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          file_size?: number
          id?: string
          issued_on?: string | null
          mime_type?: string
          original_name?: string
          storage_path?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_documents_business_space_id_fkey"
            columns: ["business_space_id"]
            isOneToOne: false
            referencedRelation: "business_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_documents_category_space_fkey"
            columns: ["category_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      space_expenses: {
        Row: {
          amount: number
          business_space_id: string
          concept: string
          created_at: string
          id: string
          spent_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          business_space_id: string
          concept: string
          created_at?: string
          id?: string
          spent_on: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_space_id?: string
          concept?: string
          created_at?: string
          id?: string
          spent_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_expenses_business_space_id_fkey"
            columns: ["business_space_id"]
            isOneToOne: false
            referencedRelation: "business_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_daily_company_option_totals: {
        Row: {
          business_space_id: string | null
          category_id: string | null
          category_name: string | null
          category_sort_order: number | null
          company_id: string | null
          company_name: string | null
          option_id: string | null
          option_name: string | null
          service_date: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_selection_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_selection_items_option_fkey"
            columns: ["option_id", "category_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_options"
            referencedColumns: ["id", "category_id"]
          },
          {
            foreignKeyName: "employee_selections_company_fkey"
            columns: ["company_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      v_daily_company_totals: {
        Row: {
          business_space_id: string | null
          company_id: string | null
          company_name: string | null
          service_date: string | null
          total_viandas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_selections_company_fkey"
            columns: ["company_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "business_space_id"]
          },
        ]
      }
      v_daily_option_totals: {
        Row: {
          business_space_id: string | null
          category_id: string | null
          category_name: string | null
          category_sort_order: number | null
          option_id: string | null
          option_name: string | null
          service_date: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_selection_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_selection_items_option_fkey"
            columns: ["option_id", "category_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_options"
            referencedColumns: ["id", "category_id"]
          },
        ]
      }
      v_selection_details: {
        Row: {
          apellido: string | null
          business_space_id: string | null
          category_id: string | null
          category_name: string | null
          category_sort_order: number | null
          company_id: string | null
          company_name: string | null
          dni: string | null
          employee_id: string | null
          is_locked: boolean | null
          locked_at: string | null
          nombre: string | null
          option_id: string | null
          option_name: string | null
          selection_id: string | null
          service_date: string | null
          status: Database["public"]["Enums"]["selection_status"] | null
          submitted_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_selection_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_selection_items_option_fkey"
            columns: ["option_id", "category_id"]
            isOneToOne: false
            referencedRelation: "gastronomic_options"
            referencedColumns: ["id", "category_id"]
          },
          {
            foreignKeyName: "employee_selections_company_fkey"
            columns: ["company_id", "business_space_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "business_space_id"]
          },
          {
            foreignKeyName: "employee_selections_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_company_member: {
        Args: {
          p_company_id: string
          p_dni: string
          p_role?: Database["public"]["Enums"]["app_role"]
          p_started_at?: string
        }
        Returns: string
      }
      cancel_my_selection: {
        Args: { p_selection_id: string }
        Returns: undefined
      }
      end_membership: {
        Args: { p_ended_at?: string; p_membership_id: string }
        Returns: undefined
      }
      find_profile_by_dni: {
        Args: { p_dni: string }
        Returns: {
          activo: boolean
          apellido: string
          nombre: string
          profile_id: string
        }[]
      }
      get_my_menu: {
        Args: { p_service_date: string; p_company_id?: string }
        Returns: {
          calendar_day_id: string
          category_id: string
          category_name: string
          category_sort_order: number
          company_id: string
          company_name: string
          deadline: string
          is_selected: boolean
          option_id: string
          option_name: string
          option_sort_order: number
          service_date: string
          window_open: boolean
        }[]
      }
      get_my_roles: {
        Args: never
        Returns: {
          business_space_id: string | null
          company_id: string | null
          ended_at: string | null
          membership_id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          started_at: string
        }[]
      }
      get_selection_deadline: {
        Args: { p_service_date: string }
        Returns: string
      }
      extra_tray_days_until: {
        Args: { p_space_id: string; p_until: string }
        Returns: {
          company_id: string
          service_date: string
          trays: number
        }[]
      }
      save_company_extras: {
        Args: { p_calendar_day_id: string; p_items: Json; p_company_id?: string }
        Returns: undefined
      }
      save_employee_choice: {
        Args: { p_calendar_day_id: string; p_items: Json; p_membership_id: string }
        Returns: string
      }
      selection_window_open: {
        Args: { p_calendar_day_id: string; p_company_id: string }
        Returns: boolean
      }
      tray_days_until: {
        Args: { p_space_id: string; p_until: string }
        Returns: {
          company_id: string
          service_date: string
          trays: number
        }[]
      }
      save_my_selection: {
        Args: { p_calendar_day_id: string; p_items: Json; p_company_id?: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "ORG_ADMIN" | "SPACE_ADMIN" | "COMPANY_ADMIN" | "EMPLOYEE"
      calendar_week_status: "DRAFT" | "PUBLISHED"
      event_status: "BORRADOR" | "CONFIRMADO" | "REALIZADO" | "CANCELADO"
      market_order_status: "RECIBIDO" | "CONFIRMADO" | "ENTREGADO" | "CANCELADO"
      fixed_month_status: "PENDIENTE" | "PAGADO" | "NO_APLICA"
      membership_status: "ACTIVE" | "SUSPENDED" | "ENDED"
      payment_method: "EFECTIVO" | "TRANSFERENCIA" | "ECHEQ"
      payment_status: "PENDIENTE" | "PAGADO"
      selection_status: "SUBMITTED" | "CANCELLED"
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
      app_role: ["ORG_ADMIN", "SPACE_ADMIN", "COMPANY_ADMIN", "EMPLOYEE"],
      calendar_week_status: ["DRAFT", "PUBLISHED"],
      event_status: ["BORRADOR", "CONFIRMADO", "REALIZADO", "CANCELADO"],
      market_order_status: ["RECIBIDO", "CONFIRMADO", "ENTREGADO", "CANCELADO"],
      fixed_month_status: ["PENDIENTE", "PAGADO", "NO_APLICA"],
      membership_status: ["ACTIVE", "SUSPENDED", "ENDED"],
      payment_method: ["EFECTIVO", "TRANSFERENCIA", "ECHEQ"],
      payment_status: ["PENDIENTE", "PAGADO"],
      selection_status: ["SUBMITTED", "CANCELLED"],
    },
  },
} as const

