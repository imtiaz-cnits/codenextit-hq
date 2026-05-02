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
      attendance: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          email: string | null
          id: string
          ltv: number
          notes: string | null
          phone: string | null
          updated_at: string
          vat_bin: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          email?: string | null
          id?: string
          ltv?: number
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vat_bin?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          email?: string | null
          id?: string
          ltv?: number
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vat_bin?: string | null
        }
        Relationships: []
      }
      company_holidays: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          avatar_url: string | null
          blood_group: string | null
          emergency_contact: string | null
          full_name: string | null
          notes: string | null
          phone: string | null
          base_salary: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          department: string
          designation: string | null
          employee_code: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          id: string
          joined_at: string
          profile_id: string
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          blood_group?: string | null
          emergency_contact?: string | null
          full_name?: string | null
          notes?: string | null
          phone?: string | null
          base_salary?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          department?: string
          designation?: string | null
          employee_code?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          joined_at?: string
          profile_id: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          blood_group?: string | null
          emergency_contact?: string | null
          full_name?: string | null
          notes?: string | null
          phone?: string | null
          base_salary?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          department?: string
          designation?: string | null
          employee_code?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          joined_at?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Relationships: []
      }
      expense_entries: {
        Row: {
          amount: number
          approval: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          comments: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          date: string
          id: string
          purpose: string
          recorded_by: string | null
          type: Database["public"]["Enums"]["expense_type"]
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          approval?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          comments?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          date?: string
          id?: string
          purpose: string
          recorded_by?: string | null
          type?: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          approval?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          comments?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          date?: string
          id?: string
          purpose?: string
          recorded_by?: string | null
          type?: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string | null
          id: string
          recorded_by: string | null
          spent_at: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string | null
          id?: string
          recorded_by?: string | null
          spent_at?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string | null
          id?: string
          recorded_by?: string | null
          spent_at?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      income_entries: {
        Row: {
          amount: number
          approval: Database["public"]["Enums"]["approval_status"]
          client_id: string | null
          comments: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          date: string
          id: string
          purpose: string
          recorded_by: string | null
          type: Database["public"]["Enums"]["income_type"]
          updated_at: string
        }
        Insert: {
          amount?: number
          approval?: Database["public"]["Enums"]["approval_status"]
          client_id?: string | null
          comments?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          date?: string
          id?: string
          purpose: string
          recorded_by?: string | null
          type?: Database["public"]["Enums"]["income_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          approval?: Database["public"]["Enums"]["approval_status"]
          client_id?: string | null
          comments?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          date?: string
          id?: string
          purpose?: string
          recorded_by?: string | null
          type?: Database["public"]["Enums"]["income_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      infrastructure_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          client_id: string | null
          cost: number
          created_at: string
          credentials_encrypted: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          expires_at: string | null
          id: string
          name: string
          notes: string | null
          provider: string | null
          updated_at: string
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          client_id?: string | null
          cost?: number
          created_at?: string
          credentials_encrypted?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          expires_at?: string | null
          id?: string
          name: string
          notes?: string | null
          provider?: string | null
          updated_at?: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          client_id?: string | null
          cost?: number
          created_at?: string
          credentials_encrypted?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          expires_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          provider?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "infrastructure_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          amount: number
          comments: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          date: string
          id: string
          investor: string | null
          purpose: string
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          comments?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          date?: string
          id?: string
          investor?: string | null
          purpose: string
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          comments?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          date?: string
          id?: string
          investor?: string | null
          purpose?: string
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount: number | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          position: number
          quantity: number
          unit_price: number
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          position?: number
          quantity?: number
          unit_price?: number
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          position?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          due_at: string | null
          id: string
          issued_at: string
          notes: string | null
          number: string
          paid_amount: number
          paid_at: string | null
          project_id: string | null
          quote_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          title: string
          total: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          due_at?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          number: string
          paid_amount?: number
          paid_at?: string | null
          project_id?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title: string
          total?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          due_at?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          number?: string
          paid_amount?: number
          paid_at?: string | null
          project_id?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company_name: string
          contact_person: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          email: string | null
          estimated_value: number
          id: string
          notes: string | null
          phone: string | null
          position: number
          source: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          title: string
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_person?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          email?: string | null
          estimated_value?: number
          id?: string
          notes?: string | null
          phone?: string | null
          position?: number
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          title: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_person?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          email?: string | null
          estimated_value?: number
          id?: string
          notes?: string | null
          phone?: string | null
          position?: number
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          employee_id: string
          from_date: string
          id: string
          reason: string | null
          status: Database["public"]["Enums"]["leave_status"]
          to_date: string
          type: Database["public"]["Enums"]["leave_type"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id: string
          from_date: string
          id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["leave_status"]
          to_date: string
          type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          from_date?: string
          id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["leave_status"]
          to_date?: string
          type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          base: number
          bonus: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deduction: number
          employee_id: string
          id: string
          month: string
          net: number | null
          paid_at: string | null
          status: Database["public"]["Enums"]["payroll_status"]
          updated_at: string
        }
        Insert: {
          base?: number
          bonus?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deduction?: number
          employee_id: string
          id?: string
          month: string
          net?: number | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          updated_at?: string
        }
        Update: {
          base?: number
          bonus?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deduction?: number
          employee_id?: string
          id?: string
          month?: string
          net?: number | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blood_group: string | null
          client_id: string | null
          created_at: string
          designation: string | null
          email: string
          emergency_contact: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          blood_group?: string | null
          client_id?: string | null
          created_at?: string
          designation?: string | null
          email?: string
          emergency_contact?: string | null
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          blood_group?: string | null
          client_id?: string | null
          created_at?: string
          designation?: string | null
          email?: string
          emergency_contact?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number
          category: Database["public"]["Enums"]["project_category"]
          client_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deadline: string | null
          description: string | null
          id: string
          name: string
          progress: number
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          budget?: number
          category?: Database["public"]["Enums"]["project_category"]
          client_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deadline?: string | null
          description?: string | null
          id?: string
          name: string
          progress?: number
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          budget?: number
          category?: Database["public"]["Enums"]["project_category"]
          client_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deadline?: string | null
          description?: string | null
          id?: string
          name?: string
          progress?: number
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          amount: number | null
          created_at: string
          description: string
          id: string
          position: number
          quantity: number
          quote_id: string
          unit_price: number
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description: string
          id?: string
          position?: number
          quantity?: number
          quote_id: string
          unit_price?: number
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string
          id?: string
          position?: number
          quantity?: number
          quote_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          issued_at: string
          notes: string | null
          number: string
          project_id: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          title: string
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          issued_at?: string
          notes?: string | null
          number: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          issued_at?: string
          notes?: string | null
          number?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_sheet: {
        Row: {
          amount: number
          comments: string | null
          created_at: string
          date: string
          id: string
          payouts: Json
          purpose: string
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          comments?: string | null
          created_at?: string
          date?: string
          id?: string
          payouts?: Json
          purpose: string
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          comments?: string | null
          created_at?: string
          date?: string
          id?: string
          payouts?: Json
          purpose?: string
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          status: Database["public"]["Enums"]["task_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_webhook_settings: {
        Row: {
          enabled: boolean
          id: boolean
          rotated_at: string
          secret: string
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          rotated_at?: string
          secret: string
        }
        Update: {
          enabled?: boolean
          id?: boolean
          rotated_at?: string
          secret?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          project_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_logs: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number
          id: string
          logged_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number
          id?: string
          logged_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number
          id?: string
          logged_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vault_files: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          mime_type: string | null
          name: string
          project_id: string | null
          size_bytes: number
          storage_path: string | null
          type: Database["public"]["Enums"]["vault_file_type"]
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          project_id?: string | null
          size_bytes?: number
          storage_path?: string | null
          type?: Database["public"]["Enums"]["vault_file_type"]
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          project_id?: string | null
          size_bytes?: number
          storage_path?: string | null
          type?: Database["public"]["Enums"]["vault_file_type"]
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          accent_color: string
          address: string | null
          company_name: string
          email: string | null
          footer_note: string | null
          id: boolean
          logo_url: string | null
          payment_instructions: string | null
          phone: string | null
          primary_color: string
          tagline: string | null
          terms: string | null
          updated_at: string
          vat_bin: string | null
          website: string | null
        }
        Insert: {
          accent_color?: string
          address?: string | null
          company_name?: string
          email?: string | null
          footer_note?: string | null
          id?: boolean
          logo_url?: string | null
          payment_instructions?: string | null
          phone?: string | null
          primary_color?: string
          tagline?: string | null
          terms?: string | null
          updated_at?: string
          vat_bin?: string | null
          website?: string | null
        }
        Update: {
          accent_color?: string
          address?: string | null
          company_name?: string
          email?: string | null
          footer_note?: string | null
          id?: boolean
          logo_url?: string | null
          payment_instructions?: string | null
          phone?: string | null
          primary_color?: string
          tagline?: string | null
          terms?: string | null
          updated_at?: string
          vat_bin?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_client_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      recalc_project_progress: {
        Args: { _project_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "project_manager" | "staff" | "client"
      approval_status: "pending" | "approved" | "rejected"
      asset_type: "domain" | "ssl" | "hosting" | "vps" | "subscription"
      currency_code: "BDT" | "USD"
      employee_status: "active" | "on_leave" | "terminated"
      employment_type: "full_time" | "part_time" | "contractor" | "intern"
      expense_category:
        | "software"
        | "office_rent"
        | "utility"
        | "seo_tools"
        | "marketing"
        | "travel"
        | "equipment"
        | "salary"
        | "other"
      expense_type:
        | "office"
        | "software"
        | "travel"
        | "salary"
        | "utility"
        | "marketing"
        | "other"
      income_type: "project" | "service" | "retainer" | "other"
      invoice_status:
        | "draft"
        | "sent"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
      lead_stage:
        | "new_inquiry"
        | "meeting_scheduled"
        | "proposal_sent"
        | "negotiation"
        | "won"
        | "lost"
      leave_status: "pending" | "approved" | "rejected"
      leave_type: "sick" | "casual" | "annual" | "unpaid"
      payroll_status: "draft" | "paid"
      project_category:
        | "mern"
        | "laravel_php"
        | "wordpress"
        | "ui_ux"
        | "technical_seo"
        | "geo"
        | "aeo"
        | "schema_audit"
        | "other"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      quote_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
      task_priority: "low" | "normal" | "high" | "critical"
      task_status:
        | "todo"
        | "in_progress"
        | "qa_testing"
        | "client_review"
        | "done"
      ticket_priority: "low" | "normal" | "high" | "critical"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_client"
        | "resolved"
        | "closed"
      vault_file_type:
        | "logo"
        | "srs"
        | "api_doc"
        | "design"
        | "contract"
        | "other"
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
      app_role: ["super_admin", "project_manager", "staff", "client"],
      approval_status: ["pending", "approved", "rejected"],
      asset_type: ["domain", "ssl", "hosting", "vps", "subscription"],
      currency_code: ["BDT", "USD"],
      employee_status: ["active", "on_leave", "terminated"],
      employment_type: ["full_time", "part_time", "contractor", "intern"],
      expense_category: [
        "software",
        "office_rent",
        "utility",
        "seo_tools",
        "marketing",
        "travel",
        "equipment",
        "salary",
        "other",
      ],
      expense_type: [
        "office",
        "software",
        "travel",
        "salary",
        "utility",
        "marketing",
        "other",
      ],
      income_type: ["project", "service", "retainer", "other"],
      invoice_status: [
        "draft",
        "sent",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      lead_stage: [
        "new_inquiry",
        "meeting_scheduled",
        "proposal_sent",
        "negotiation",
        "won",
        "lost",
      ],
      leave_status: ["pending", "approved", "rejected"],
      leave_type: ["sick", "casual", "annual", "unpaid"],
      payroll_status: ["draft", "paid"],
      project_category: [
        "mern",
        "laravel_php",
        "wordpress",
        "ui_ux",
        "technical_seo",
        "geo",
        "aeo",
        "schema_audit",
        "other",
      ],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
      quote_status: ["draft", "sent", "accepted", "rejected", "expired"],
      task_priority: ["low", "normal", "high", "critical"],
      task_status: [
        "todo",
        "in_progress",
        "qa_testing",
        "client_review",
        "done",
      ],
      ticket_priority: ["low", "normal", "high", "critical"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_client",
        "resolved",
        "closed",
      ],
      vault_file_type: [
        "logo",
        "srs",
        "api_doc",
        "design",
        "contract",
        "other",
      ],
    },
  },
} as const
