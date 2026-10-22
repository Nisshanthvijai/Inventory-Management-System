/**
 * Generated from the Supabase project's schema (supabase gen types typescript) on 2026-10-22.
 * Do not edit by hand: regenerate after every migration.
 * Only infrastructure uses it: use cases see Sessions and their own read models, not tables.
 */
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      brand: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      doc_counter: {
        Row: {
          doc_type: string
          last_no: number
          year: number
        }
        Insert: {
          doc_type: string
          last_no?: number
          year: number
        }
        Update: {
          doc_type?: string
          last_no?: number
          year?: number
        }
        Relationships: []
      }
      goods_receipt: {
        Row: {
          comments: string | null
          created_at: string
          grn_no: string
          id: string
          invoice_date: string | null
          invoice_no: string
          po_id: string
          received_by: string
          received_date: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          grn_no: string
          id?: string
          invoice_date?: string | null
          invoice_no: string
          po_id: string
          received_by?: string
          received_date?: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          grn_no?: string
          id?: string
          invoice_date?: string | null
          invoice_no?: string
          po_id?: string
          received_by?: string
          received_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "v_grn_lines"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "goods_receipt_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "v_po_lines"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "goods_receipt_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "v_purchase_order"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "goods_receipt_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_line: {
        Row: {
          completes_line: boolean
          created_at: string
          grn_id: string
          id: string
          item_id: string
          po_id: string
          po_line_id: string
          received_quantity: number
          variant_id: string
        }
        Insert: {
          completes_line?: boolean
          created_at?: string
          grn_id: string
          id?: string
          item_id: string
          po_id: string
          po_line_id: string
          received_quantity: number
          variant_id: string
        }
        Update: {
          completes_line?: boolean
          created_at?: string
          grn_id?: string
          id?: string
          item_id?: string
          po_id?: string
          po_line_id?: string
          received_quantity?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grn_line_header_fk"
            columns: ["grn_id", "po_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt"
            referencedColumns: ["id", "po_id"]
          },
          {
            foreignKeyName: "grn_line_po_line_fk"
            columns: ["po_line_id", "po_id"]
            isOneToOne: false
            referencedRelation: "po_line"
            referencedColumns: ["id", "po_id"]
          },
          {
            foreignKeyName: "grn_line_po_line_item_fk"
            columns: ["po_line_id", "item_id"]
            isOneToOne: false
            referencedRelation: "po_line"
            referencedColumns: ["id", "item_id"]
          },
          {
            foreignKeyName: "grn_line_variant_fk"
            columns: ["variant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "item_variant"
            referencedColumns: ["id", "item_id"]
          },
          {
            foreignKeyName: "grn_line_variant_fk"
            columns: ["variant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_variants"
            referencedColumns: ["variant_id", "item_id"]
          },
        ]
      }
      item: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_category"
            referencedColumns: ["id"]
          },
        ]
      }
      item_category: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      item_type: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      item_variant: {
        Row: {
          brand_id: string
          code: string
          created_at: string
          id: string
          inventory_uom_id: string
          is_active: boolean
          item_id: string
          purchase_uom_id: string
          reorder_level: number
          type_id: string
          units_per_purchase: number
          updated_at: string
        }
        Insert: {
          brand_id: string
          code: string
          created_at?: string
          id?: string
          inventory_uom_id: string
          is_active?: boolean
          item_id: string
          purchase_uom_id: string
          reorder_level?: number
          type_id: string
          units_per_purchase?: number
          updated_at?: string
        }
        Update: {
          brand_id?: string
          code?: string
          created_at?: string
          id?: string
          inventory_uom_id?: string
          is_active?: boolean
          item_id?: string
          purchase_uom_id?: string
          reorder_level?: number
          type_id?: string
          units_per_purchase?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_variant_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_variant_inventory_uom_id_fkey"
            columns: ["inventory_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_variant_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_variant_purchase_uom_id_fkey"
            columns: ["purchase_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_variant_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "item_type"
            referencedColumns: ["id"]
          },
        ]
      }
      po_line: {
        Row: {
          arrival_date: string | null
          created_at: string
          gst: number
          id: string
          is_complete: boolean
          item_id: string
          po_id: string
          pr_line_id: string
          price: number
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          arrival_date?: string | null
          created_at?: string
          gst?: number
          id?: string
          is_complete?: boolean
          item_id: string
          po_id: string
          pr_line_id: string
          price: number
          quantity: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          arrival_date?: string | null
          created_at?: string
          gst?: number
          id?: string
          is_complete?: boolean
          item_id?: string
          po_id?: string
          pr_line_id?: string
          price?: number
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_line_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_line_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "v_grn_lines"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "po_line_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "v_po_lines"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "po_line_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "v_purchase_order"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "po_line_pr_line_fk"
            columns: ["pr_line_id", "item_id"]
            isOneToOne: false
            referencedRelation: "pr_line"
            referencedColumns: ["id", "item_id"]
          },
          {
            foreignKeyName: "po_line_variant_fk"
            columns: ["variant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "item_variant"
            referencedColumns: ["id", "item_id"]
          },
          {
            foreignKeyName: "po_line_variant_fk"
            columns: ["variant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_variants"
            referencedColumns: ["variant_id", "item_id"]
          },
        ]
      }
      pr_line: {
        Row: {
          approved_quantity: number | null
          created_at: string
          id: string
          item_id: string
          pr_id: string
          quantity: number
          rejection_comment: string | null
          status: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          approved_quantity?: number | null
          created_at?: string
          id?: string
          item_id: string
          pr_id: string
          quantity: number
          rejection_comment?: string | null
          status?: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          approved_quantity?: number | null
          created_at?: string
          id?: string
          item_id?: string
          pr_id?: string
          quantity?: number
          rejection_comment?: string | null
          status?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pr_line_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pr_line_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "v_pr_lines"
            referencedColumns: ["pr_id"]
          },
          {
            foreignKeyName: "pr_line_variant_fk"
            columns: ["variant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "item_variant"
            referencedColumns: ["id", "item_id"]
          },
          {
            foreignKeyName: "pr_line_variant_fk"
            columns: ["variant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_variants"
            referencedColumns: ["variant_id", "item_id"]
          },
        ]
      }
      profile: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          role?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string
        }
        Relationships: []
      }
      purchase_order: {
        Row: {
          comments: string | null
          created_at: string
          created_by: string
          id: string
          payment_terms: string | null
          po_date: string
          po_no: string
          status: string
          updated_at: string
          vendor_address: string | null
          vendor_gst_no: string | null
          vendor_id: string
          vendor_name: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          created_by?: string
          id?: string
          payment_terms?: string | null
          po_date?: string
          po_no: string
          status?: string
          updated_at?: string
          vendor_address?: string | null
          vendor_gst_no?: string | null
          vendor_id: string
          vendor_name: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          created_by?: string
          id?: string
          payment_terms?: string | null
          po_date?: string
          po_no?: string
          status?: string
          updated_at?: string
          vendor_address?: string | null
          vendor_gst_no?: string | null
          vendor_id?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisition: {
        Row: {
          created_at: string
          id: string
          pr_date: string
          pr_no: string
          priority: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pr_date?: string
          pr_no: string
          priority?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pr_date?: string
          pr_no?: string
          priority?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      stock: {
        Row: {
          id: string
          quantity: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          id?: string
          quantity?: number
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          id?: string
          quantity?: number
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "item_variant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "v_grn_lines"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "v_po_lines"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "v_pr_lines"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "v_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "v_variants"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      uom: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      vendor: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          gst_no: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_no?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_no?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_grn_lines: {
        Row: {
          brand_name: string | null
          comments: string | null
          completes_line: boolean | null
          created_at: string | null
          grn_id: string | null
          grn_line_id: string | null
          grn_no: string | null
          in_stock_units_text: string | null
          invoice_date: string | null
          invoice_no: string | null
          is_substitute: boolean | null
          item_name: string | null
          po_id: string | null
          po_line_id: string | null
          po_no: string | null
          purchase_unit: string | null
          received_by: string | null
          received_by_name: string | null
          received_date: string | null
          received_quantity: number | null
          received_text: string | null
          stock_unit: string | null
          type_name: string | null
          units_per_purchase: number | null
          variant_code: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      v_po_lines: {
        Row: {
          arrival_date: string | null
          brand_name: string | null
          gst: number | null
          in_stock_units_text: string | null
          is_complete: boolean | null
          item_name: string | null
          line_total: number | null
          line_total_with_gst: number | null
          ordered_stock_units: number | null
          ordered_text: string | null
          po_id: string | null
          po_line_id: string | null
          po_no: string | null
          po_status: string | null
          pr_line_id: string | null
          pr_no: string | null
          price: number | null
          price_text: string | null
          purchase_unit: string | null
          quantity: number | null
          received_quantity: number | null
          stock_unit: string | null
          type_name: string | null
          units_per_purchase: number | null
          variant_code: string | null
          variant_id: string | null
          vendor_name: string | null
        }
        Relationships: []
      }
      v_pr_lines: {
        Row: {
          approved_quantity: number | null
          approved_text: string | null
          brand_name: string | null
          created_at: string | null
          item_name: string | null
          line_status: string | null
          pr_date: string | null
          pr_id: string | null
          pr_line_id: string | null
          pr_no: string | null
          pr_status: string | null
          priority: string | null
          quantity: number | null
          rejection_comment: string | null
          requested_by: string | null
          requested_by_name: string | null
          requested_text: string | null
          stock_unit: string | null
          type_name: string | null
          variant_code: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      v_purchase_order: {
        Row: {
          against_pr: string | null
          comments: string | null
          created_at: string | null
          created_by: string | null
          line_count: number | null
          payment_terms: string | null
          po_date: string | null
          po_id: string | null
          po_no: string | null
          status: string | null
          total_before_gst: number | null
          total_with_gst: number | null
          vendor_address: string | null
          vendor_gst_no: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          against_pr?: never
          comments?: string | null
          created_at?: string | null
          created_by?: string | null
          line_count?: never
          payment_terms?: string | null
          po_date?: string | null
          po_id?: string | null
          po_no?: string | null
          status?: string | null
          total_before_gst?: never
          total_with_gst?: never
          vendor_address?: string | null
          vendor_gst_no?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          against_pr?: never
          comments?: string | null
          created_at?: string | null
          created_by?: string | null
          line_count?: never
          payment_terms?: string | null
          po_date?: string | null
          po_id?: string | null
          po_no?: string | null
          status?: string | null
          total_before_gst?: never
          total_with_gst?: never
          vendor_address?: string | null
          vendor_gst_no?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock: {
        Row: {
          at_or_below_reorder: boolean | null
          brand_name: string | null
          item_name: string | null
          quantity: number | null
          quantity_text: string | null
          reorder_level: number | null
          stock_id: string | null
          stock_unit: string | null
          type_name: string | null
          updated_at: string | null
          updated_by: string | null
          variant_code: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      v_variants: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          category_id: string | null
          category_name: string | null
          code: string | null
          created_at: string | null
          inventory_uom_id: string | null
          is_active: boolean | null
          item_id: string | null
          item_name: string | null
          orderable: boolean | null
          purchase_unit: string | null
          purchase_uom_id: string | null
          reorder_level: number | null
          stock_unit: string | null
          type_id: string | null
          type_name: string | null
          units_per_purchase: number | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_variant_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_variant_inventory_uom_id_fkey"
            columns: ["inventory_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_variant_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_variant_purchase_uom_id_fkey"
            columns: ["purchase_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_variant_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "item_type"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_grn: {
        Args: {
          p_comments?: string
          p_invoice_date?: string
          p_invoice_no: string
          p_lines: Json
          p_po_id: string
          p_received_date?: string
        }
        Returns: Json
      }
      create_po: {
        Args: {
          p_comments?: string
          p_lines: Json
          p_payment_terms?: string
          p_po_date?: string
          p_vendor_id: string
        }
        Returns: Json
      }
      create_pr: { Args: { p_lines: Json; p_priority?: string }; Returns: Json }
      get_my_po_lines: {
        Args: never
        Returns: {
          arrival_date: string
          brand_name: string
          can_receive: boolean
          is_complete: boolean
          item_name: string
          ordered_quantity: number
          po_date: string
          po_id: string
          po_line_id: string
          po_no: string
          po_status: string
          pr_no: string
          purchase_unit: string
          received_other_variants: number
          received_same_variant: number
          type_name: string
          variant_code: string
          variant_id: string
          vendor_name: string
        }[]
      }
      next_doc_no: { Args: { p_prefix: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

/** The row type of a table or view, e.g. `Row<"v_stock">`. */
export type Row<Name extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[Name] extends { Row: infer R } ? R : never

/** The return type of an RPC, e.g. `RpcResult<"get_my_po_lines">`. */
export type RpcResult<Name extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][Name]["Returns"]
