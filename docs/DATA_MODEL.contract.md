CONTRACT (tables and key columns; add sensible FKs, indexes and checks)
Enums: firm_role(admin,staff); client_role(owner,staff);
 scheme(regular,qrmp,composition,unregistered);
 aato_band(below_40l,40l_to_1_5cr,1_5cr_to_5cr,above_5cr);
 lang(en,hi,mr); doc_kind(purchase_bill,gstr2b_file,sales_file,bank_file,other);
 doc_status(uploaded,queued,processing,needs_review,done,failed);
 inv_status(draft,needs_review,approved,rejected);
 inv_source(extracted,manual,imported);
 itc_state(eligible,ineligible,blocked,pending);
 filing_status(unknown,filed,not_filed,cancelled);
 pay_mode(cash,upi,bank,other); rate_status(ok,mismatch,unknown);
 gstr2b_section(b2b,b2ba,cdnr,cdnra); ims_action(none,accepted,rejected,pending);
 recon_status(matched,fuzzy_match,period_shift,missing_in_2b,
 missing_in_books,mismatch); user_decision(none,accepted,disputed,ignored);
 sales_source(manual,csv,upi_statement);
 sales_doc_type(tax_invoice,bill_of_supply,invoice_cum_bos,credit_note,
 debit_note); return_type(gstr1,gstr3b,cmp08,gstr4);
 return_status(not_started,draft,in_review,approved,filed);
 alert_kind(deadline,itc_at_risk,threshold,missing_docs,rule_change,late_fee);
 severity(info,warn,urgent); alert_status(open,dismissed,done).
TENANCY: firms(id,name,created_by); firm_members(firm_id,user_id,role);
 clients(firm_id,legal_name,trade_name,gstin [unique per firm],state_code,
 scheme,aato_band,fy_start_month default 4,language,sells_exempt,
 sells_taxable); client_access(firm_id,client_id,user_id,role);
 platform_admins(user_id).
DOCUMENTS: documents(firm_id,client_id,kind,storage_path,original_name,
 mime_type,size_bytes,sha256,status,uploaded_by,period_fp);
 unique(client_id,sha256) where deleted_at is null.
PURCHASES: suppliers(firm_id,client_id,gstin,name,filing_status,
 last_checked_at,notes); invoices(firm_id,client_id,supplier_id,document_id,
 invoice_no,invoice_no_norm,invoice_date,place_of_supply,taxable_value,cgst,
 sgst,igst,cess,round_off,total,status,source,itc_state,period_fp);
 invoice_lines(invoice_id,line_no,description,hsn,qty,unit,unit_price,
 taxable_value,tax_rate,cgst,sgst,igst,cess,rate_rule_id,rate_status);
 invoice_payments(invoice_id,paid_on,amount,mode).
EXTRACTION: extraction_fields(document_id,invoice_id,field_path,
 ai_initial_value,confidence numeric(4,3),bbox jsonb,final_value,modified_by,
 modified_at,model_version,rule_snapshot_id).
GSTR2B: gstr2b_imports(client_id,document_id,return_period_fp,generated_on,
 is_recompute,imported_by,record_count); gstr2b_records(import_id,section,
 supplier_gstin,supplier_name,doc_no,doc_no_norm,doc_date,doc_type,
 taxable_value,cgst,sgst,igst,cess,itc_available,itc_reason,ims_action).
RECON: reconciliation_runs(client_id,period_fp,import_id,status,started_at,
 finished_at,summary jsonb,rule_snapshot_id); reconciliation_results(run_id,
 invoice_id,gstr2b_record_id,status,match_pass smallint,diff_taxable,diff_tax,
 itc_at_risk,user_decision,decided_by,decided_at).
SALES/RETURNS: sales_entries(client_id,entry_date,cash_total,upi_total,
 taxable_sales,exempt_sales,source,document_id); sales_invoices(client_id,
 invoice_no,invoice_date,buyer_gstin,place_of_supply,taxable_value,cgst,sgst,
 igst,cess,total,doc_type,status); return_periods(client_id,return_type,fp,
 due_date,status,filed_on,ack_ref); return_drafts(return_period_id,version,
 payload jsonb,rule_snapshot_id,created_by,approved_by).
RULES (global, no firm_id): rule_snapshots(id,label,checksum,created_at);
 gst_rate_rules(hsn_prefix,description_pattern,rate,effective_from,
 effective_to,source_ref,verified_by_ca default false,notes);
 rule_params(key,value jsonb,effective_from,effective_to,source_ref,
 verified_by_ca default false).
AUDIT/ALERTS: audit_events(firm_id,client_id,actor_id,action,entity,entity_id,
 before jsonb,after jsonb,created_at) APPEND-ONLY; alerts(firm_id,client_id,
 kind,severity,title,body,due_date,status).
