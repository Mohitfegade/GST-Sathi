export interface Gstr2bRecord {
  supplier_gstin: string;
  doc_no: string;
  doc_date: string;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  section: string;
}

export interface Gstr2bParsedResult {
  generated_on: Date;
  fp: string;
  records: Array<Gstr2bRecord>;
}

export interface Gstr2bSourceAdapter {
  parseGstr2bJson(jsonString: string): Promise<{
    generated_on: Date;
    fp: string;
    records: Array<{
      supplier_gstin: string;
      doc_no: string;
      doc_date: string;
      taxable_value: number;
      cgst: number;
      sgst: number;
      igst: number;
      section: string;
    }>;
  }>;
}

function parseFlexibleDate(dateVal: unknown): Date {
  if (dateVal instanceof Date) {
    return dateVal;
  }
  if (typeof dateVal === 'string' && dateVal.trim().length > 0) {
    const trimmed = dateVal.trim();
    // Match DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyy = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      const hour = ddmmyyyy[4] ? parseInt(ddmmyyyy[4], 10) : 0;
      const minute = ddmmyyyy[5] ? parseInt(ddmmyyyy[5], 10) : 0;
      const second = ddmmyyyy[6] ? parseInt(ddmmyyyy[6], 10) : 0;
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

function parseNumeric(val: unknown): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export class LocalGstr2bFileSourceAdapter implements Gstr2bSourceAdapter {
  async parseGstr2bJson(jsonString: string): Promise<Gstr2bParsedResult> {
    if (!jsonString || typeof jsonString !== 'string') {
      throw new Error('GSTR-2B input must be a valid non-empty JSON string');
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(jsonString);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse GSTR-2B JSON: ${message}`);
    }

    // Determine data root
    const dataRoot = (typeof payload.data === 'object' && payload.data !== null
      ? payload.data
      : payload) as Record<string, unknown>;

    // 1. Extract filing period (fp)
    const fpRaw = payload.fp ?? dataRoot.fp ?? '';
    const fp = String(fpRaw).trim();

    // 2. Extract generated_on
    const genDtRaw =
      payload.generated_on ??
      payload.gen_dt ??
      payload.genDt ??
      dataRoot.generated_on ??
      dataRoot.gen_dt ??
      dataRoot.genDt;
    const generated_on = parseFlexibleDate(genDtRaw);

    const records: Gstr2bRecord[] = [];

    // Case A: Pre-flattened records array
    const candidateRecords = payload.records ?? dataRoot.records;
    if (Array.isArray(candidateRecords)) {
      for (const item of candidateRecords) {
        if (typeof item === 'object' && item !== null) {
          const rec = item as Record<string, unknown>;
          records.push({
            supplier_gstin: String(rec.supplier_gstin ?? rec.ctin ?? rec.gstin ?? '').trim(),
            doc_no: String(rec.doc_no ?? rec.inum ?? rec.nt_num ?? rec.docNo ?? '').trim(),
            doc_date: String(rec.doc_date ?? rec.idt ?? rec.nt_dt ?? rec.docDate ?? '').trim(),
            taxable_value: parseNumeric(rec.taxable_value ?? rec.txval),
            cgst: parseNumeric(rec.cgst ?? rec.camt),
            sgst: parseNumeric(rec.sgst ?? rec.samt),
            igst: parseNumeric(rec.igst ?? rec.iamt),
            section: String(rec.section ?? 'B2B').toUpperCase(),
          });
        }
      }
      return { generated_on, fp, records };
    }

    // Case B: Standard GSTN docdata schema
    const docdata = (payload.docdata ?? dataRoot.docdata) as Record<string, unknown> | undefined;
    if (docdata && typeof docdata === 'object') {
      const sections = Object.keys(docdata);

      for (const sectionName of sections) {
        const sectionContent = docdata[sectionName];
        if (!Array.isArray(sectionContent)) continue;

        for (const supplierEntry of sectionContent) {
          if (typeof supplierEntry !== 'object' || supplierEntry === null) continue;
          const supp = supplierEntry as Record<string, unknown>;
          const supplier_gstin = String(supp.ctin ?? supp.supplier_gstin ?? supp.gstin ?? '').trim();

          // Documents may be in inv, nt, docs, or invoices
          const docList: unknown[] = [];
          if (Array.isArray(supp.inv)) docList.push(...supp.inv);
          if (Array.isArray(supp.nt)) docList.push(...supp.nt);
          if (Array.isArray(supp.docs)) docList.push(...supp.docs);
          if (Array.isArray(supp.invoices)) docList.push(...supp.invoices);

          // If no doc list found, check if supp itself is a document
          if (docList.length === 0 && (supp.inum || supp.doc_no || supp.nt_num)) {
            docList.push(supp);
          }

          for (const docItem of docList) {
            if (typeof docItem !== 'object' || docItem === null) continue;
            const doc = docItem as Record<string, unknown>;

            const doc_no = String(doc.inum ?? doc.nt_num ?? doc.doc_no ?? doc.docNo ?? '').trim();
            const doc_date = String(doc.idt ?? doc.nt_dt ?? doc.doc_date ?? doc.docDate ?? '').trim();

            let taxable_value = 0;
            let cgst = 0;
            let sgst = 0;
            let igst = 0;

            if (Array.isArray(doc.items) && doc.items.length > 0) {
              for (const it of doc.items) {
                if (typeof it === 'object' && it !== null) {
                  const itObj = it as Record<string, unknown>;
                  // item data can be direct or inside itm_det
                  const det = (typeof itObj.itm_det === 'object' && itObj.itm_det !== null
                    ? itObj.itm_det
                    : itObj) as Record<string, unknown>;

                  taxable_value += parseNumeric(det.txval ?? det.taxable_value);
                  cgst += parseNumeric(det.camt ?? det.cgst);
                  sgst += parseNumeric(det.samt ?? det.sgst);
                  igst += parseNumeric(det.iamt ?? det.igst);
                }
              }
            } else {
              taxable_value = parseNumeric(doc.taxable_value ?? doc.txval ?? doc.val);
              cgst = parseNumeric(doc.cgst ?? doc.camt);
              sgst = parseNumeric(doc.sgst ?? doc.samt);
              igst = parseNumeric(doc.igst ?? doc.iamt);
            }

            records.push({
              supplier_gstin,
              doc_no,
              doc_date,
              taxable_value: Math.round(taxable_value * 100) / 100,
              cgst: Math.round(cgst * 100) / 100,
              sgst: Math.round(sgst * 100) / 100,
              igst: Math.round(igst * 100) / 100,
              section: sectionName.toUpperCase(),
            });
          }
        }
      }
    }

    return {
      generated_on,
      fp,
      records,
    };
  }
}
