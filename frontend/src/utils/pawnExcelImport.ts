import * as XLSX from 'xlsx-js-style';
import type { GoldPurity, WeightKPY } from '../types/gold';
import {
  calculateGoldValuation,
  calculateNetWeight,
  gramsToKpy,
  KYAT_TO_GRAMS,
} from './goldCalculations';

/** Canonical English keys used in the template header row (row 1). */
export const PAWN_IMPORT_HEADERS = [
  'vno',
  'customer_name',
  'customer_phone',
  'item_name',
  'item_type',
  'gold_kind',
  'purity',
  'weight_grams',
  'weight_kyat',
  'weight_pae',
  'weight_yway',
  'loan_amount',
  'loan_amount_baht',
  'monthly_interest_rate',
  'loss_months',
  'start_date',
  'last_interest_date',
  'notes',
  'pawn_ticket_no',
] as const;

/** Burmese labels shown on row 0 (guide). */
export const PAWN_IMPORT_HEADERS_MM: Record<(typeof PAWN_IMPORT_HEADERS)[number], string> = {
  vno: 'ဗောင်ချာ / VNO',
  customer_name: 'အမည် *',
  customer_phone: 'ဖုန်း *',
  item_name: 'ပစ္စည်းအမည် *',
  item_type: 'ပစ္စည်းအမျိုးအစား (RING…)',
  gold_kind: 'ရွှေအမျိုး (MYANMAR/THAI/MIXED)',
  purity: 'အရည်အသွေး (MEELIN/THAI_GOLD…)',
  weight_grams: 'အလေးချိန် ဂရမ်',
  weight_kyat: 'ကျပ်',
  weight_pae: 'ပဲ',
  weight_yway: 'ရွေး',
  loan_amount: 'ချေးငွေ ကျပ်',
  loan_amount_baht: 'ချေးငွေ ဘတ်',
  monthly_interest_rate: 'အတိုးနှုန်း %',
  loss_months: 'အရှုံးလ',
  start_date: 'ပေါင်ရက် * (YYYY-MM-DD)',
  last_interest_date: 'နောက်ဆုံးအတိုးရက်',
  notes: 'မှတ်ချက်',
  pawn_ticket_no: 'ပေါင်လက်မှတ်နံပါတ် (ဗလာထားရင် အလိုအလျောက်)',
};

export type PawnImportRow = {
  pawn_ticket_no?: string;
  vno?: string;
  customer_name: string;
  customer_phone: string;
  item_name: string;
  item_type: string;
  gold_kind: string;
  purity: GoldPurity;
  weight: WeightKPY;
  weight_grams: number;
  evaluated_value: number;
  loan_amount: number;
  loan_amount_baht: number;
  monthly_interest_rate: number;
  loss_months: number;
  start_date: string;
  last_interest_date: string;
  due_date: string;
  next_interest_date: string;
  notes?: string;
  accrued_interest: number;
};

export type PawnImportParseError = { row: number; message: string };

const HEADER_ALIASES: Record<string, (typeof PAWN_IMPORT_HEADERS)[number]> = {
  vno: 'vno',
  voucher: 'vno',
  voucher_no: 'vno',
  'ဗောင်ချာ': 'vno',
  'ဗောင်ချာ/vno': 'vno',
  customer_name: 'customer_name',
  name: 'customer_name',
  'အမည်': 'customer_name',
  'အမည်*': 'customer_name',
  customer_phone: 'customer_phone',
  phone: 'customer_phone',
  'ဖုန်း': 'customer_phone',
  'ဖုန်း*': 'customer_phone',
  item_name: 'item_name',
  'ပစ္စည်းအမည်': 'item_name',
  'ပစ္စည်းအမည်*': 'item_name',
  item_type: 'item_type',
  'ပစ္စည်းအမျိုးအစား': 'item_type',
  gold_kind: 'gold_kind',
  'ရွှေအမျိုး': 'gold_kind',
  purity: 'purity',
  'အရည်အသွေး': 'purity',
  weight_grams: 'weight_grams',
  grams: 'weight_grams',
  'အလေးချိန်ဂရမ်': 'weight_grams',
  'ဂရမ်': 'weight_grams',
  weight_kyat: 'weight_kyat',
  kyat: 'weight_kyat',
  'ကျပ်': 'weight_kyat',
  weight_pae: 'weight_pae',
  pae: 'weight_pae',
  'ပဲ': 'weight_pae',
  weight_yway: 'weight_yway',
  yway: 'weight_yway',
  'ရွေး': 'weight_yway',
  loan_amount: 'loan_amount',
  loan_mmk: 'loan_amount',
  'ချေးငွေကျပ်': 'loan_amount',
  loan_amount_baht: 'loan_amount_baht',
  loan_baht: 'loan_amount_baht',
  'ချေးငွေဘတ်': 'loan_amount_baht',
  monthly_interest_rate: 'monthly_interest_rate',
  interest_rate: 'monthly_interest_rate',
  'အတိုးနှုန်း': 'monthly_interest_rate',
  'အတိုးနှုန်း%': 'monthly_interest_rate',
  loss_months: 'loss_months',
  'အရှုံးလ': 'loss_months',
  start_date: 'start_date',
  pawn_date: 'start_date',
  'ပေါင်ရက်': 'start_date',
  last_interest_date: 'last_interest_date',
  'နောက်ဆုံးအတိုးရက်': 'last_interest_date',
  notes: 'notes',
  'မှတ်ချက်': 'notes',
  pawn_ticket_no: 'pawn_ticket_no',
  ticket_no: 'pawn_ticket_no',
  'ပေါင်လက်မှတ်နံပါတ်': 'pawn_ticket_no',
};

function normHeader(h: unknown): string {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）]/g, '')
    .replace(/\*/g, '');
}

function cellStr(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function cellNum(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** Excel serial date or string → YYYY-MM-DD */
function cellDate(v: unknown): string {
  if (v == null || v === '') return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) {
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${mm}-${dd}`;
    }
  }
  const s = String(v).trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m1) {
    return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  const m2 = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m2) {
    return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function mapGoldKind(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (!s) return 'MYANMAR';
  if (s.includes('THAI') || s.includes('ထိုင်း')) return 'THAI';
  if (s.includes('MIX') || s.includes('ရော')) return 'MIXED';
  if (s.includes('MYAN') || s.includes('မြန်')) return 'MYANMAR';
  if (s === 'THAI' || s === 'MYANMAR' || s === 'MIXED') return s;
  return s;
}

function mapPurity(raw: string, goldKind: string): GoldPurity {
  if (goldKind === 'THAI') return 'THAI_GOLD';
  const s = raw.trim().toUpperCase().replace(/\s+/g, '');
  const allowed: GoldPurity[] = [
    'MEELIN',
    'K24',
    'PE15A',
    'PE15B',
    'PE14A',
    'PE13A',
    'PE12A',
    'K18',
    'THAI_GOLD',
  ];
  if (allowed.includes(s as GoldPurity)) return s as GoldPurity;
  const mmMap: Record<string, GoldPurity> = {
    မီးလင်း: 'MEELIN',
    '24K': 'K24',
    '15A': 'PE15A',
    '15B': 'PE15B',
    '14A': 'PE14A',
    '13A': 'PE13A',
    '12A': 'PE12A',
    '18K': 'K18',
    ထိုင်းရွှေ: 'THAI_GOLD',
  };
  if (mmMap[raw.trim()]) return mmMap[raw.trim()];
  return 'MEELIN';
}

function mapItemType(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (!s) return 'RING';
  const aliases: Record<string, string> = {
    RING: 'RING',
    လက်စွပ်: 'RING',
    NECKLACE: 'NECKLACE',
    လည်ဆွဲ: 'NECKLACE',
    BRACELET: 'BRACELET',
    လက်ကောက်: 'BRACELET',
    EARRING: 'EARRING',
    နားကပ်: 'EARRING',
    PENDANT: 'PENDANT',
    ဆွဲသီး: 'PENDANT',
    BANGLE: 'BANGLE',
    လက်ကြပ်: 'BANGLE',
  };
  if (aliases[s] || aliases[raw.trim()]) return aliases[s] || aliases[raw.trim()];
  return s.replace(/\s+/g, '_') || 'RING';
}

/** Download a sample Excel with Burmese guide row + English keys + 2 example rows. */
export function downloadPawnImportTemplate(): void {
  const wb = XLSX.utils.book_new();
  const headers = [...PAWN_IMPORT_HEADERS];
  const mmRow = headers.map((h) => PAWN_IMPORT_HEADERS_MM[h]);
  const sample1 = [
    'V-001',
    'ဒေါ်ခင်လှိုင်',
    '09450012345',
    'နဂါးလိမ်ဆွဲကြိုး',
    'NECKLACE',
    'MYANMAR',
    'MEELIN',
    16.6,
    1,
    0,
    0,
    5000000,
    0,
    5,
    3,
    '2026-10-01',
    '2026-10-01',
    'နမူနာ အပေါင်',
    '',
  ];
  const sample2 = [
    'V-002',
    'ဦးကျော်ဇင်',
    '09795678901',
    'Thai chain',
    'NECKLACE',
    'THAI',
    'THAI_GOLD',
    7.5,
    '',
    '',
    '',
    0,
    35000,
    5,
    3,
    '2026-10-05',
    '',
    'ထိုင်းရွှေ နမူနာ',
    '',
  ];
  const guide = [
    ['အပေါင် Excel Import နမူနာ'],
    ['အတန်း ၁ = မြန်မာလမ်းညွှန်၊ အတန်း ၂ = English column keys (မပြောင်းပါနှင့်)၊ အတန်း ၃+ = ဒေတာ'],
    ['* လိုအပ်ချက် — customer_name, customer_phone, item_name, start_date၊ ချေးငွေ ကျပ် သို့မဟုတ် ဘတ် တစ်ခုခု'],
    ['အလေးချိန် — weight_grams သို့မဟုတ် weight_kyat/pae/yway'],
    ['pawn_ticket_no ဗလာထားရင် စနစ်က အလိုအလျောက် ထုတ်ပေးမည်'],
    [],
  ];
  const aoa = [...guide, mmRow, headers, sample1, sample2];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, 'PawnImport');
  XLSX.writeFile(wb, 'pawn_import_sample.xlsx');
}

function resolveHeaderMap(headerCells: unknown[]): Map<number, (typeof PAWN_IMPORT_HEADERS)[number]> {
  const map = new Map<number, (typeof PAWN_IMPORT_HEADERS)[number]>();
  headerCells.forEach((cell, idx) => {
    const key = normHeader(cell);
    const field = HEADER_ALIASES[key];
    if (field) map.set(idx, field);
    // Also match exact English header
    const asCanon = PAWN_IMPORT_HEADERS.find((h) => h === key || normHeader(h) === key);
    if (asCanon) map.set(idx, asCanon);
  });
  return map;
}

/**
 * Parse a pawn import workbook. Accepts template (MM row + EN row) or a sheet
 * whose first row is English keys / Burmese aliases.
 */
export function parsePawnImportFile(
  buffer: ArrayBuffer,
  opts: {
    pure16Price: number;
    priceForPurity: (p: GoldPurity) => number | undefined;
    kyatToGrams?: number;
  }
): { rows: PawnImportRow[]; errors: PawnImportParseError[] } {
  const kyatToGrams = opts.kyatToGrams || KYAT_TO_GRAMS;
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { rows: [], errors: [{ row: 0, message: 'Sheet not found' }] };

  const aoa = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];

  // Find header row: prefer a row that contains customer_name (English key row)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 12); i++) {
    const cells = aoa[i] || [];
    const joined = cells.map(normHeader).join('|');
    if (joined.includes('customer_name') || joined.includes('အမည်')) {
      // Prefer English key row when both MM guide + EN exist
      if (joined.includes('customer_name')) {
        headerRowIdx = i;
        break;
      }
      if (headerRowIdx < 0) headerRowIdx = i;
    }
  }
  if (headerRowIdx < 0) {
    return {
      rows: [],
      errors: [{ row: 0, message: 'Header row မတွေ့ပါ — နမူနာ Excel ကို သုံးပါ' }],
    };
  }

  const headerMap = resolveHeaderMap(aoa[headerRowIdx] || []);
  if (![...headerMap.values()].includes('customer_name')) {
    return {
      rows: [],
      errors: [{ row: headerRowIdx + 1, message: 'customer_name / အမည် ကော်လံ လိုအပ်သည်' }],
    };
  }

  const rows: PawnImportRow[] = [];
  const errors: PawnImportParseError[] = [];

  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const line = aoa[r] || [];
    const obj: Partial<Record<(typeof PAWN_IMPORT_HEADERS)[number], unknown>> = {};
    let any = false;
    headerMap.forEach((field, col) => {
      const v = line[col];
      if (v != null && String(v).trim() !== '') any = true;
      obj[field] = v;
    });
    if (!any) continue;

    const excelRow = r + 1;
    try {
      const customer_name = cellStr(obj.customer_name);
      const customer_phone = cellStr(obj.customer_phone);
      const item_name = cellStr(obj.item_name);
      const start_date = cellDate(obj.start_date);
      if (!customer_name) throw new Error('အမည် လိုအပ်သည်');
      if (!customer_phone) throw new Error('ဖုန်း လိုအပ်သည်');
      if (!item_name) throw new Error('ပစ္စည်းအမည် လိုအပ်သည်');
      if (!start_date) throw new Error('ပေါင်ရက် (start_date) လိုအပ်သည်');

      const gold_kind = mapGoldKind(cellStr(obj.gold_kind));
      const purity = mapPurity(cellStr(obj.purity), gold_kind);
      const item_type = mapItemType(cellStr(obj.item_type));

      let grams = cellNum(obj.weight_grams);
      let kyat = cellNum(obj.weight_kyat);
      let pae = cellNum(obj.weight_pae);
      let yway = cellNum(obj.weight_yway);
      if (grams > 0 && kyat === 0 && pae === 0 && yway === 0) {
        const kpy = gramsToKpy(grams, kyatToGrams);
        kyat = kpy.kyat;
        pae = kpy.pae;
        yway = Number(kpy.yway.toFixed(3));
      } else if (grams <= 0 && (kyat > 0 || pae > 0 || yway > 0)) {
        grams = Number(
          (
            (kyat + pae / 16 + yway / 128) *
            kyatToGrams
          ).toFixed(4)
        );
      }
      if (grams <= 0 && kyat <= 0 && pae <= 0 && yway <= 0) {
        throw new Error('အလေးချိန် (ဂရမ် သို့မဟုတ် ကျပ်/ပဲ/ရွေး) လိုအပ်သည်');
      }

      const loan_amount = cellNum(obj.loan_amount);
      const loan_amount_baht = cellNum(obj.loan_amount_baht);
      if (loan_amount <= 0 && loan_amount_baht <= 0) {
        throw new Error('ချေးငွေ ကျပ် သို့မဟုတ် ဘတ် လိုအပ်သည်');
      }

      const monthly_interest_rate = cellNum(obj.monthly_interest_rate) || 5;
      const loss_months = Math.max(1, cellNum(obj.loss_months) || 3);
      const last_interest_date = cellDate(obj.last_interest_date) || start_date;
      const due_date = addMonthsISO(last_interest_date, loss_months);
      const next_interest_date = addMonthsISO(last_interest_date, 1);

      const net = calculateNetWeight({ kyat, pae, yway }, 0, 0);
      const specific = opts.priceForPurity(purity);
      const val = calculateGoldValuation(net, purity, opts.pure16Price, specific);
      const principal = loan_amount_baht > 0 && loan_amount <= 0 ? loan_amount_baht : loan_amount;
      const accrued = Math.round((principal * monthly_interest_rate) / 100);

      rows.push({
        pawn_ticket_no: cellStr(obj.pawn_ticket_no) || undefined,
        vno: cellStr(obj.vno) || undefined,
        customer_name,
        customer_phone,
        item_name,
        item_type,
        gold_kind,
        purity,
        weight: net,
        weight_grams: grams,
        evaluated_value: val.goldAmount,
        loan_amount,
        loan_amount_baht,
        monthly_interest_rate,
        loss_months,
        start_date,
        last_interest_date,
        due_date,
        next_interest_date,
        notes: cellStr(obj.notes) || undefined,
        accrued_interest: accrued,
      });
    } catch (err) {
      errors.push({
        row: excelRow,
        message: err instanceof Error ? err.message : 'Invalid row',
      });
    }
  }

  return { rows, errors };
}

export function makePawnTicketNo(startDate: string, index: number): string {
  const rand = Math.floor(100 + Math.random() * 900);
  return `PWN-${startDate.replace(/-/g, '')}-${rand}${index}`;
}
