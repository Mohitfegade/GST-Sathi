
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "alerts": {
                  Row: {
                    "body": string,"client_id": string | null,"created_at": string,"deleted_at": string | null,"due_date": string | null,"firm_id": string,"id": string,"kind": Database["public"]['Enums']["alert_kind"],"severity": Database["public"]['Enums']["severity"],"status": Database["public"]['Enums']["alert_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"client_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"due_date"?: string | null,"firm_id": string,"id"?: string,"kind": Database["public"]['Enums']["alert_kind"],"severity"?: Database["public"]['Enums']["severity"],"status"?: Database["public"]['Enums']["alert_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"client_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"due_date"?: string | null,"firm_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["alert_kind"],"severity"?: Database["public"]['Enums']["severity"],"status"?: Database["public"]['Enums']["alert_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fk_alerts_client_firm"
      columns: ["client_id","firm_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id","firm_id"]
    }
                  ]
                },"audit_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"after": Json | null,"before": Json | null,"client_id": string | null,"created_at": string,"entity": string,"entity_id": string,"firm_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"client_id"?: string | null,"created_at"?: string,"entity": string,"entity_id": string,"firm_id": string,"id"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"client_id"?: string | null,"created_at"?: string,"entity"?: string,"entity_id"?: string,"firm_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_events_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"client_access": {
                  Row: {
                    "client_id": string,"created_at": string,"deleted_at": string | null,"firm_id": string,"id": string,"role": Database["public"]['Enums']["client_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"deleted_at"?: string | null,"firm_id": string,"id"?: string,"role"?: Database["public"]['Enums']["client_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"firm_id"?: string,"id"?: string,"role"?: Database["public"]['Enums']["client_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_access_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_access_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fk_client_access_client_firm"
      columns: ["client_id","firm_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id","firm_id"]
    }
                  ]
                },"client_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"client_id": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"expires_at": string,"firm_id": string,"id": string,"token_hash": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"client_id": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"expires_at"?: string,"firm_id": string,"id"?: string,"token_hash": string,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"client_id"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"expires_at"?: string,"firm_id"?: string,"id"?: string,"token_hash"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_invites_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_invites_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fk_client_invites_client_firm"
      columns: ["client_id","firm_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id","firm_id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "aato_band": Database["public"]['Enums']["aato_band"],"created_at": string,"deleted_at": string | null,"firm_id": string,"fy_start_month": number,"gstin": string,"id": string,"language": Database["public"]['Enums']["lang"],"legal_name": string,"scheme": Database["public"]['Enums']["scheme"],"sells_exempt": boolean,"sells_taxable": boolean,"state_code": string,"trade_name": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aato_band"?: Database["public"]['Enums']["aato_band"],"created_at"?: string,"deleted_at"?: string | null,"firm_id": string,"fy_start_month"?: number,"gstin": string,"id"?: string,"language"?: Database["public"]['Enums']["lang"],"legal_name": string,"scheme"?: Database["public"]['Enums']["scheme"],"sells_exempt"?: boolean,"sells_taxable"?: boolean,"state_code": string,"trade_name"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "aato_band"?: Database["public"]['Enums']["aato_band"],"created_at"?: string,"deleted_at"?: string | null,"firm_id"?: string,"fy_start_month"?: number,"gstin"?: string,"id"?: string,"language"?: Database["public"]['Enums']["lang"],"legal_name"?: string,"scheme"?: Database["public"]['Enums']["scheme"],"sells_exempt"?: boolean,"sells_taxable"?: boolean,"state_code"?: string,"trade_name"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "client_id": string,"created_at": string,"deleted_at": string | null,"firm_id": string,"id": string,"kind": Database["public"]['Enums']["doc_kind"],"mime_type": string,"original_name": string,"period_fp": string | null,"sha256": string,"size_bytes": number,"status": Database["public"]['Enums']["doc_status"],"storage_path": string,"updated_at": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"deleted_at"?: string | null,"firm_id": string,"id"?: string,"kind": Database["public"]['Enums']["doc_kind"],"mime_type": string,"original_name": string,"period_fp"?: string | null,"sha256": string,"size_bytes": number,"status"?: Database["public"]['Enums']["doc_status"],"storage_path": string,"updated_at"?: string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"firm_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["doc_kind"],"mime_type"?: string,"original_name"?: string,"period_fp"?: string | null,"sha256"?: string,"size_bytes"?: number,"status"?: Database["public"]['Enums']["doc_status"],"storage_path"?: string,"updated_at"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fk_documents_client_firm"
      columns: ["client_id","firm_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id","firm_id"]
    }
                  ]
                },"extraction_fields": {
                  Row: {
                    "ai_initial_value": string | null,"bbox": Json | null,"confidence": number | null,"created_at": string,"deleted_at": string | null,"document_id": string,"field_path": string,"final_value": string | null,"id": string,"invoice_id": string | null,"model_version": string | null,"modified_at": string | null,"modified_by": string | null,"rule_snapshot_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_initial_value"?: string | null,"bbox"?: Json | null,"confidence"?: number | null,"created_at"?: string,"deleted_at"?: string | null,"document_id": string,"field_path": string,"final_value"?: string | null,"id"?: string,"invoice_id"?: string | null,"model_version"?: string | null,"modified_at"?: string | null,"modified_by"?: string | null,"rule_snapshot_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ai_initial_value"?: string | null,"bbox"?: Json | null,"confidence"?: number | null,"created_at"?: string,"deleted_at"?: string | null,"document_id"?: string,"field_path"?: string,"final_value"?: string | null,"id"?: string,"invoice_id"?: string | null,"model_version"?: string | null,"modified_at"?: string | null,"modified_by"?: string | null,"rule_snapshot_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "extraction_fields_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "extraction_fields_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"firm_members": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"firm_id": string,"id": string,"role": Database["public"]['Enums']["firm_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"firm_id": string,"id"?: string,"role"?: Database["public"]['Enums']["firm_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"firm_id"?: string,"id"?: string,"role"?: Database["public"]['Enums']["firm_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "firm_members_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"firms": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"gst_rate_rules": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"description_pattern": string | null,"effective_from": string,"effective_to": string | null,"hsn_prefix": string,"id": string,"notes": string | null,"rate": number,"source_ref": string,"updated_at": string,"verified_by_ca": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"description_pattern"?: string | null,"effective_from": string,"effective_to"?: string | null,"hsn_prefix": string,"id"?: string,"notes"?: string | null,"rate": number,"source_ref": string,"updated_at"?: string,"verified_by_ca"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"description_pattern"?: string | null,"effective_from"?: string,"effective_to"?: string | null,"hsn_prefix"?: string,"id"?: string,"notes"?: string | null,"rate"?: number,"source_ref"?: string,"updated_at"?: string,"verified_by_ca"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"gstr2b_imports": {
                  Row: {
                    "client_id": string,"created_at": string,"deleted_at": string | null,"document_id": string | null,"firm_id": string,"generated_on": string,"id": string,"imported_by": string | null,"is_recompute": boolean,"record_count": number,"return_period_fp": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"deleted_at"?: string | null,"document_id"?: string | null,"firm_id": string,"generated_on": string,"id"?: string,"imported_by"?: string | null,"is_recompute"?: boolean,"record_count"?: number,"return_period_fp": string,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"document_id"?: string | null,"firm_id"?: string,"generated_on"?: string,"id"?: string,"imported_by"?: string | null,"is_recompute"?: boolean,"record_count"?: number,"return_period_fp"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fk_gstr2b_imports_client_firm"
      columns: ["client_id","firm_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id","firm_id"]
    },{
      foreignKeyName: "gstr2b_imports_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gstr2b_imports_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gstr2b_imports_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"gstr2b_records": {
                  Row: {
                    "cess": number,"cgst": number,"created_at": string,"deleted_at": string | null,"doc_date": string,"doc_no": string,"doc_no_norm": string,"doc_type": string,"id": string,"igst": number,"import_id": string,"ims_action": Database["public"]['Enums']["ims_action"],"ims_action_at": string | null,"ims_action_by": string | null,"itc_available": boolean,"itc_reason": string | null,"section": Database["public"]['Enums']["gstr2b_section"],"sgst": number,"supplier_gstin": string,"supplier_name": string | null,"taxable_value": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cess"?: number,"cgst"?: number,"created_at"?: string,"deleted_at"?: string | null,"doc_date": string,"doc_no": string,"doc_no_norm": string,"doc_type"?: string,"id"?: string,"igst"?: number,"import_id": string,"ims_action"?: Database["public"]['Enums']["ims_action"],"ims_action_at"?: string | null,"ims_action_by"?: string | null,"itc_available"?: boolean,"itc_reason"?: string | null,"section"?: Database["public"]['Enums']["gstr2b_section"],"sgst"?: number,"supplier_gstin": string,"supplier_name"?: string | null,"taxable_value"?: number,"updated_at"?: string
                  }
                  Update: {
                    "cess"?: number,"cgst"?: number,"created_at"?: string,"deleted_at"?: string | null,"doc_date"?: string,"doc_no"?: string,"doc_no_norm"?: string,"doc_type"?: string,"id"?: string,"igst"?: number,"import_id"?: string,"ims_action"?: Database["public"]['Enums']["ims_action"],"ims_action_at"?: string | null,"ims_action_by"?: string | null,"itc_available"?: boolean,"itc_reason"?: string | null,"section"?: Database["public"]['Enums']["gstr2b_section"],"sgst"?: number,"supplier_gstin"?: string,"supplier_name"?: string | null,"taxable_value"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gstr2b_records_import_id_fkey"
      columns: ["import_id"]
isOneToOne: false
      referencedRelation: "gstr2b_imports"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_lines": {
                  Row: {
                    "cess": number,"cgst": number,"created_at": string,"deleted_at": string | null,"description": string,"hsn": string | null,"id": string,"igst": number,"invoice_id": string,"line_no": number,"qty": number,"rate_rule_id": string | null,"rate_status": Database["public"]['Enums']["rate_status"],"sgst": number,"tax_rate": number,"taxable_value": number,"unit": string,"unit_price": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cess"?: number,"cgst"?: number,"created_at"?: string,"deleted_at"?: string | null,"description": string,"hsn"?: string | null,"id"?: string,"igst"?: number,"invoice_id": string,"line_no": number,"qty"?: number,"rate_rule_id"?: string | null,"rate_status"?: Database["public"]['Enums']["rate_status"],"sgst"?: number,"tax_rate"?: number,"taxable_value"?: number,"unit"?: string,"unit_price"?: number,"updated_at"?: string
                  }
                  Update: {
                    "cess"?: number,"cgst"?: number,"created_at"?: string,"deleted_at"?: string | null,"description"?: string,"hsn"?: string | null,"id"?: string,"igst"?: number,"invoice_id"?: string,"line_no"?: number,"qty"?: number,"rate_rule_id"?: string | null,"rate_status"?: Database["public"]['Enums']["rate_status"],"sgst"?: number,"tax_rate"?: number,"taxable_value"?: number,"unit"?: string,"unit_price"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_lines_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_payments": {
                  Row: {
                    "amount": number,"created_at": string,"deleted_at": string | null,"id": string,"invoice_id": string,"mode": Database["public"]['Enums']["pay_mode"],"paid_on": string,"reference_no": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"invoice_id": string,"mode"?: Database["public"]['Enums']["pay_mode"],"paid_on": string,"reference_no"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"invoice_id"?: string,"mode"?: Database["public"]['Enums']["pay_mode"],"paid_on"?: string,"reference_no"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "cess": number,"cgst": number,"client_id": string,"created_at": string,"deleted_at": string | null,"document_id": string | null,"firm_id": string,"id": string,"igst": number,"invoice_date": string,"invoice_no": string,"invoice_no_norm": string,"itc_state": Database["public"]['Enums']["itc_state"],"period_fp": string,"place_of_supply": string,"round_off": number,"sgst": number,"source": Database["public"]['Enums']["inv_source"],"status": Database["public"]['Enums']["inv_status"],"supplier_id": string | null,"taxable_value": number,"total": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cess"?: number,"cgst"?: number,"client_id": string,"created_at"?: string,"deleted_at"?: string | null,"document_id"?: string | null,"firm_id": string,"id"?: string,"igst"?: number,"invoice_date": string,"invoice_no": string,"invoice_no_norm": string,"itc_state"?: Database["public"]['Enums']["itc_state"],"period_fp": string,"place_of_supply": string,"round_off"?: number,"sgst"?: number,"source"?: Database["public"]['Enums']["inv_source"],"status"?: Database["public"]['Enums']["inv_status"],"supplier_id"?: string | null,"taxable_value"?: number,"total"?: number,"updated_at"?: string
                  }
                  Update: {
                    "cess"?: number,"cgst"?: number,"client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"document_id"?: string | null,"firm_id"?: string,"id"?: string,"igst"?: number,"invoice_date"?: string,"invoice_no"?: string,"invoice_no_norm"?: string,"itc_state"?: Database["public"]['Enums']["itc_state"],"period_fp"?: string,"place_of_supply"?: string,"round_off"?: number,"sgst"?: number,"source"?: Database["public"]['Enums']["inv_source"],"status"?: Database["public"]['Enums']["inv_status"],"supplier_id"?: string | null,"taxable_value"?: number,"total"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fk_invoices_client_firm"
      columns: ["client_id","firm_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id","firm_id"]
    },{
      foreignKeyName: "invoices_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reconciliation_results": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"deleted_at": string | null,"diff_tax": number,"diff_taxable": number,"gstr2b_record_id": string | null,"id": string,"invoice_id": string | null,"itc_at_risk": number,"match_pass": number,"run_id": string,"status": Database["public"]['Enums']["recon_status"],"updated_at": string,"user_decision": Database["public"]['Enums']["user_decision"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"deleted_at"?: string | null,"diff_tax"?: number,"diff_taxable"?: number,"gstr2b_record_id"?: string | null,"id"?: string,"invoice_id"?: string | null,"itc_at_risk"?: number,"match_pass"?: number,"run_id": string,"status": Database["public"]['Enums']["recon_status"],"updated_at"?: string,"user_decision"?: Database["public"]['Enums']["user_decision"]
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"deleted_at"?: string | null,"diff_tax"?: number,"diff_taxable"?: number,"gstr2b_record_id"?: string | null,"id"?: string,"invoice_id"?: string | null,"itc_at_risk"?: number,"match_pass"?: number,"run_id"?: string,"status"?: Database["public"]['Enums']["recon_status"],"updated_at"?: string,"user_decision"?: Database["public"]['Enums']["user_decision"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reconciliation_results_gstr2b_record_id_fkey"
      columns: ["gstr2b_record_id"]
isOneToOne: false
      referencedRelation: "gstr2b_records"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reconciliation_results_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reconciliation_results_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "reconciliation_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"reconciliation_runs": {
                  Row: {
                    "client_id": string,"created_at": string,"deleted_at": string | null,"finished_at": string | null,"firm_id": string,"id": string,"import_id": string | null,"period_fp": string,"rule_snapshot_id": string | null,"started_at": string,"status": string,"summary": Json | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"deleted_at"?: string | null,"finished_at"?: string | null,"firm_id": string,"id"?: string,"import_id"?: string | null,"period_fp": string,"rule_snapshot_id"?: string | null,"started_at"?: string,"status"?: string,"summary"?: Json | null,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"finished_at"?: string | null,"firm_id"?: string,"id"?: string,"import_id"?: string | null,"period_fp"?: string,"rule_snapshot_id"?: string | null,"started_at"?: string,"status"?: string,"summary"?: Json | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fk_recon_runs_client_firm"
      columns: ["client_id","firm_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id","firm_id"]
    },{
      foreignKeyName: "reconciliation_runs_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reconciliation_runs_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reconciliation_runs_import_id_fkey"
      columns: ["import_id"]
isOneToOne: false
      referencedRelation: "gstr2b_imports"
      referencedColumns: ["id"]
    }
                  ]
                },"return_drafts": {
                  Row: {
                    "approved_by": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"payload": NonNullable<Json>,"return_period_id": string,"rule_snapshot_id": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"return_period_id": string,"rule_snapshot_id"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "approved_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"return_period_id"?: string,"rule_snapshot_id"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "return_drafts_return_period_id_fkey"
      columns: ["return_period_id"]
isOneToOne: false
      referencedRelation: "return_periods"
      referencedColumns: ["id"]
    }
                  ]
                },"return_periods": {
                  Row: {
                    "ack_ref": string | null,"client_id": string,"created_at": string,"deleted_at": string | null,"due_date": string,"filed_on": string | null,"firm_id": string,"fp": string,"id": string,"return_type": Database["public"]['Enums']["return_type"],"status": Database["public"]['Enums']["return_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ack_ref"?: string | null,"client_id": string,"created_at"?: string,"deleted_at"?: string | null,"due_date": string,"filed_on"?: string | null,"firm_id": string,"fp": string,"id"?: string,"return_type": Database["public"]['Enums']["return_type"],"status"?: Database["public"]['Enums']["return_status"],"updated_at"?: string
                  }
                  Update: {
                    "ack_ref"?: string | null,"client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"due_date"?: string,"filed_on"?: string | null,"firm_id"?: string,"fp"?: string,"id"?: string,"return_type"?: Database["public"]['Enums']["return_type"],"status"?: Database["public"]['Enums']["return_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fk_return_periods_client_firm"
      columns: ["client_id","firm_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id","firm_id"]
    },{
      foreignKeyName: "return_periods_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "return_periods_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"rule_params": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"effective_from": string,"effective_to": string | null,"id": string,"key": string,"source_ref": string,"updated_at": string,"value": NonNullable<Json>,"verified_by_ca": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"effective_from": string,"effective_to"?: string | null,"id"?: string,"key": string,"source_ref": string,"updated_at"?: string,"value": NonNullable<Json>,"verified_by_ca"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"effective_from"?: string,"effective_to"?: string | null,"id"?: string,"key"?: string,"source_ref"?: string,"updated_at"?: string,"value"?: NonNullable<Json>,"verified_by_ca"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"rule_snapshots": {
                  Row: {
                    "checksum": string,"created_at": string,"id": string,"label": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checksum": string,"created_at"?: string,"id"?: string,"label": string
                  }
                  Update: {
                    "checksum"?: string,"created_at"?: string,"id"?: string,"label"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sales_entries": {
                  Row: {
                    "cash_total": number,"client_id": string,"created_at": string,"deleted_at": string | null,"document_id": string | null,"entry_date": string,"exempt_sales": number,"firm_id": string,"id": string,"source": Database["public"]['Enums']["sales_source"],"taxable_sales": number,"updated_at": string,"upi_total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cash_total"?: number,"client_id": string,"created_at"?: string,"deleted_at"?: string | null,"document_id"?: string | null,"entry_date": string,"exempt_sales"?: number,"firm_id": string,"id"?: string,"source"?: Database["public"]['Enums']["sales_source"],"taxable_sales"?: number,"updated_at"?: string,"upi_total"?: number
                  }
                  Update: {
                    "cash_total"?: number,"client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"document_id"?: string | null,"entry_date"?: string,"exempt_sales"?: number,"firm_id"?: string,"id"?: string,"source"?: Database["public"]['Enums']["sales_source"],"taxable_sales"?: number,"updated_at"?: string,"upi_total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "fk_sales_entries_client_firm"
      columns: ["client_id","firm_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id","firm_id"]
    },{
      foreignKeyName: "sales_entries_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_entries_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_entries_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"sales_invoices": {
                  Row: {
                    "buyer_gstin": string | null,"buyer_name": string | null,"cess": number,"cgst": number,"client_id": string,"created_at": string,"deleted_at": string | null,"doc_type": Database["public"]['Enums']["sales_doc_type"],"firm_id": string,"id": string,"igst": number,"invoice_date": string,"invoice_no": string,"place_of_supply": string,"sgst": number,"status": Database["public"]['Enums']["inv_status"],"taxable_value": number,"total": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_gstin"?: string | null,"buyer_name"?: string | null,"cess"?: number,"cgst"?: number,"client_id": string,"created_at"?: string,"deleted_at"?: string | null,"doc_type"?: Database["public"]['Enums']["sales_doc_type"],"firm_id": string,"id"?: string,"igst"?: number,"invoice_date": string,"invoice_no": string,"place_of_supply": string,"sgst"?: number,"status"?: Database["public"]['Enums']["inv_status"],"taxable_value"?: number,"total"?: number,"updated_at"?: string
                  }
                  Update: {
                    "buyer_gstin"?: string | null,"buyer_name"?: string | null,"cess"?: number,"cgst"?: number,"client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"doc_type"?: Database["public"]['Enums']["sales_doc_type"],"firm_id"?: string,"id"?: string,"igst"?: number,"invoice_date"?: string,"invoice_no"?: string,"place_of_supply"?: string,"sgst"?: number,"status"?: Database["public"]['Enums']["inv_status"],"taxable_value"?: number,"total"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fk_sales_invoices_client_firm"
      columns: ["client_id","firm_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id","firm_id"]
    },{
      foreignKeyName: "sales_invoices_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_invoices_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "client_id": string,"created_at": string,"deleted_at": string | null,"filing_status": Database["public"]['Enums']["filing_status"],"firm_id": string,"gstin": string,"id": string,"last_checked_at": string | null,"name": string,"notes": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"deleted_at"?: string | null,"filing_status"?: Database["public"]['Enums']["filing_status"],"firm_id": string,"gstin": string,"id"?: string,"last_checked_at"?: string | null,"name": string,"notes"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"filing_status"?: Database["public"]['Enums']["filing_status"],"firm_id"?: string,"gstin"?: string,"id"?: string,"last_checked_at"?: string | null,"name"?: string,"notes"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fk_suppliers_client_firm"
      columns: ["client_id","firm_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id","firm_id"]
    },{
      foreignKeyName: "suppliers_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suppliers_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_client_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"create_client_invite":
{ Args: { "p_client_id": string }; Returns: string
                           },
"create_firm_with_admin":
{ Args: { "firm_name": string }; Returns: string
                           },
"has_client_access":
{ Args: { "client": string }; Returns: boolean
                           },
"is_client_owner":
{ Args: { "client": string }; Returns: boolean
                           },
"is_firm_admin":
{ Args: { "firm": string }; Returns: boolean
                           },
"is_firm_member":
{ Args: { "firm": string }; Returns: boolean
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"peek_client_invite":
{ Args: { "p_token": string }; Returns: Json
                           }
          }
          Enums: {
            "aato_band": "below_40l"|"40l_to_1_5cr"|"1_5cr_to_5cr"|"above_5cr","alert_kind": "deadline"|"itc_at_risk"|"threshold"|"missing_docs"|"rule_change"|"late_fee","alert_status": "open"|"dismissed"|"done","client_role": "owner"|"staff","doc_kind": "purchase_bill"|"gstr2b_file"|"sales_file"|"bank_file"|"other","doc_status": "uploaded"|"queued"|"processing"|"needs_review"|"done"|"failed","filing_status": "unknown"|"filed"|"not_filed"|"cancelled","firm_role": "admin"|"staff","gstr2b_section": "b2b"|"b2ba"|"cdnr"|"cdnra","ims_action": "none"|"accepted"|"rejected"|"pending","inv_source": "extracted"|"manual"|"imported","inv_status": "draft"|"needs_review"|"approved"|"rejected","itc_state": "eligible"|"ineligible"|"blocked"|"pending","lang": "en"|"hi"|"mr","pay_mode": "cash"|"upi"|"bank"|"other","rate_status": "ok"|"mismatch"|"unknown","recon_status": "matched"|"fuzzy_match"|"period_shift"|"missing_in_2b"|"missing_in_books"|"mismatch","return_status": "not_started"|"draft"|"in_review"|"approved"|"filed","return_type": "gstr1"|"gstr3b"|"cmp08"|"gstr4","sales_doc_type": "tax_invoice"|"bill_of_supply"|"invoice_cum_bos"|"credit_note"|"debit_note","sales_source": "manual"|"csv"|"upi_statement","scheme": "regular"|"qrmp"|"composition"|"unregistered","severity": "info"|"warn"|"urgent","user_decision": "none"|"accepted"|"disputed"|"ignored"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "aato_band": ["below_40l", "40l_to_1_5cr", "1_5cr_to_5cr", "above_5cr"],"alert_kind": ["deadline", "itc_at_risk", "threshold", "missing_docs", "rule_change", "late_fee"],"alert_status": ["open", "dismissed", "done"],"client_role": ["owner", "staff"],"doc_kind": ["purchase_bill", "gstr2b_file", "sales_file", "bank_file", "other"],"doc_status": ["uploaded", "queued", "processing", "needs_review", "done", "failed"],"filing_status": ["unknown", "filed", "not_filed", "cancelled"],"firm_role": ["admin", "staff"],"gstr2b_section": ["b2b", "b2ba", "cdnr", "cdnra"],"ims_action": ["none", "accepted", "rejected", "pending"],"inv_source": ["extracted", "manual", "imported"],"inv_status": ["draft", "needs_review", "approved", "rejected"],"itc_state": ["eligible", "ineligible", "blocked", "pending"],"lang": ["en", "hi", "mr"],"pay_mode": ["cash", "upi", "bank", "other"],"rate_status": ["ok", "mismatch", "unknown"],"recon_status": ["matched", "fuzzy_match", "period_shift", "missing_in_2b", "missing_in_books", "mismatch"],"return_status": ["not_started", "draft", "in_review", "approved", "filed"],"return_type": ["gstr1", "gstr3b", "cmp08", "gstr4"],"sales_doc_type": ["tax_invoice", "bill_of_supply", "invoice_cum_bos", "credit_note", "debit_note"],"sales_source": ["manual", "csv", "upi_statement"],"scheme": ["regular", "qrmp", "composition", "unregistered"],"severity": ["info", "warn", "urgent"],"user_decision": ["none", "accepted", "disputed", "ignored"]
          }
        }
} as const
