import * as XLSX from 'xlsx-js-style';
import type { GoldPurity, WeightKPY } from '../types/gold';
import {
  calculateGoldValuation,
  calculateNetWeight,
  gramsToKpy,
  KYAT_TO_GRAMS,
} from './goldCalculations';
import { exportToExcel } from './excelExport';

/** Canonical English keys used in the template header row. */
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

export const PAWN_IMPORT_HEADERS_MM: Record<(typeof PAWN_IMPORT_HEADERS)[number], string> = {
  vno: 'VNO * (unique)',
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
  start_date: 'ပေါင်ရက် * (YYYY-MM-DD သို့မဟုတ် DD/MM/YYYY)',
  last_interest_date: 'နောက်ဆုံးအတိုးရက်',
  notes: 'မှတ်ချက်',
  pawn_ticket_no: 'ပေါင်လက်မှတ်နံပါတ် (ဗလာ = အလိုအလျောက်)',
};

export type PawnImportRow = {
  pawn_ticket_no?: string;
  vno: string;
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

export type PawnImportIssue = { row: number; message: string };

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

const ALLOWED_PURITY: GoldPurity[] = [
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

/** Parse number; returns null if non-empty but invalid. */
function cellNumStrict(v: unknown): { ok: true; value: number } | { ok: false; raw: string } {
  if (v == null || v === '') return { ok: true, value: 0 };
  if (typeof v === 'number') {
    return Number.isFinite(v) ? { ok: true, value: v } : { ok: false, raw: String(v) };
  }
  const raw = String(v).trim();
  if (!raw) return { ok: true, value: 0 };
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n)) return { ok: false, raw };
  return { ok: true, value: n };
}

type DateParse =
  | { status: 'empty' }
  | { status: 'ok'; iso: string; convertedFrom?: string }
  | { status: 'error'; raw: string };

/** Excel serial / Date / common string formats → YYYY-MM-DD (DB format). */
function cellDateStrict(v: unknown): DateParse {
  if (v == null || v === '') return { status: 'empty' };
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return { status: 'ok', iso: v.toISOString().slice(0, 10) };
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) {
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return {
        status: 'ok',
        iso: `${parsed.y}-${mm}-${dd}`,
        convertedFrom: `Excel serial ${v}`,
      };
    }
    return { status: 'error', raw: String(v) };
  }
  const s = String(v).trim();
  if (!s) return { status: 'empty' };

  const isoExact = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoExact) {
    if (!isValidYmd(+isoExact[1], +isoExact[2], +isoExact[3])) {
      return { status: 'error', raw: s };
    }
    return { status: 'ok', iso: s };
  }

  const mYmd = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (mYmd) {
    const y = +mYmd[1];
    const m = +mYmd[2];
    const d = +mYmd[3];
    if (!isValidYmd(y, m, d)) return { status: 'error', raw: s };
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return iso === s
      ? { status: 'ok', iso }
      : { status: 'ok', iso, convertedFrom: s };
  }

  const mDmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (mDmy) {
    const d = +mDmy[1];
    const m = +mDmy[2];
    const y = +mDmy[3];
    if (!isValidYmd(y, m, d)) return { status: 'error', raw: s };
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { status: 'ok', iso, convertedFrom: s };
  }

  return { status: 'error', raw: s };
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function mapGoldKind(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const s = raw.trim();
  if (!s) return { ok: true, value: 'MYANMAR' };
  const u = s.toUpperCase();
  if (u === 'MYANMAR' || u === 'THAI' || u === 'MIXED') return { ok: true, value: u };
  if (u.includes('THAI') || s.includes('ထိုင်း')) return { ok: true, value: 'THAI' };
  if (u.includes('MIX') || s.includes('ရော')) return { ok: true, value: 'MIXED' };
  if (u.includes('MYAN') || s.includes('မြန်')) return { ok: true, value: 'MYANMAR' };
  return {
    ok: false,
    message: `gold_kind "${s}" မမှန် — MYANMAR / THAI / MIXED သုံးပါ`,
  };
}

function mapPurity(
  raw: string,
  goldKind: string
): { ok: true; value: GoldPurity } | { ok: false; message: string } {
  if (goldKind === 'THAI') return { ok: true, value: 'THAI_GOLD' };
  const s = raw.trim();
  if (!s) return { ok: true, value: 'MEELIN' };
  const u = s.toUpperCase().replace(/\s+/g, '');
  if (ALLOWED_PURITY.includes(u as GoldPurity)) return { ok: true, value: u as GoldPurity };
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
  if (mmMap[s]) return { ok: true, value: mmMap[s] };
  return {
    ok: false,
    message: `purity "${s}" မမှန် — ${ALLOWED_PURITY.join(', ')}`,
  };
}

function mapItemType(raw: string): string {
  const s = raw.trim();
  if (!s) return 'RING';
  const u = s.toUpperCase();
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
  return aliases[u] || aliases[s] || u.replace(/\s+/g, '_');
}

type PawnImportSampleRow = Record<(typeof PAWN_IMPORT_HEADERS)[number], string | number>;

/** Sample Excel via project `xlsx-js-style` helper (`exportToExcel`). */
export function downloadPawnImportTemplate(): void {
  const samples: PawnImportSampleRow[] = [
    {
      vno: 'V-001',
      customer_name: 'ဒေါ်ခင်လှိုင်',
      customer_phone: '09450012345',
      item_name: 'နဂါးလိမ်ဆွဲကြိုး',
      item_type: 'NECKLACE',
      gold_kind: 'MYANMAR',
      purity: 'MEELIN',
      weight_grams: 16.6,
      weight_kyat: 1,
      weight_pae: 0,
      weight_yway: 0,
      loan_amount: 5000000,
      loan_amount_baht: 0,
      monthly_interest_rate: 5,
      loss_months: 3,
      start_date: '2026-10-01',
      last_interest_date: '2026-10-01',
      notes: 'နမူနာ အပေါင်',
      pawn_ticket_no: '',
    },
    {
      vno: 'V-002',
      customer_name: 'ဦးကျော်ဇင်',
      customer_phone: '09795678901',
      item_name: 'Thai chain',
      item_type: 'NECKLACE',
      gold_kind: 'THAI',
      purity: 'THAI_GOLD',
      weight_grams: 7.5,
      weight_kyat: '',
      weight_pae: '',
      weight_yway: '',
      loan_amount: 0,
      loan_amount_baht: 35000,
      monthly_interest_rate: 5,
      loss_months: 3,
      start_date: '05/10/2026',
      last_interest_date: '',
      notes: 'ရက်စွဲ DD/MM/YYYY နမူနာ',
      pawn_ticket_no: '',
    },
  ];

  exportToExcel<PawnImportSampleRow>({
    filename: 'pawn_import_sample',
    sheetName: 'PawnImport',
    title:
      'အပေါင် Excel Import နမူနာ — header English keys မပြောင်းပါနှင့် · vno unique * · ရက်စွဲ YYYY-MM-DD သို့မဟုတ် DD/MM/YYYY · format မမှန်ရင် တစ်ကြောင်းမှ မသွင်း (rollback)',
    columns: PAWN_IMPORT_HEADERS.map((key) => ({
      header: key,
      width: Math.max(14, Math.min(22, PAWN_IMPORT_HEADERS_MM[key].length + 2)),
      value: (row) => row[key],
    })),
    rows: samples,
  });
}

function resolveHeaderMap(headerCells: unknown[]): Map<number, (typeof PAWN_IMPORT_HEADERS)[number]> {
  const map = new Map<number, (typeof PAWN_IMPORT_HEADERS)[number]>();
  headerCells.forEach((cell, idx) => {
    const key = normHeader(cell);
    const field = HEADER_ALIASES[key];
    if (field) map.set(idx, field);
    const asCanon = PAWN_IMPORT_HEADERS.find((h) => h === key || normHeader(h) === key);
    if (asCanon) map.set(idx, asCanon);
  });
  return map;
}

export function parsePawnImportFile(
  buffer: ArrayBuffer,
  opts: {
    pure16Price: number;
    priceForPurity: (p: GoldPurity) => number | undefined;
    kyatToGrams?: number;
    /** Existing VNOs in DB (lowercase) — duplicates are errors */
    existingVnos?: Set<string>;
  }
): { rows: PawnImportRow[]; errors: PawnImportIssue[]; warnings: PawnImportIssue[] } {
  const kyatToGrams = opts.kyatToGrams || KYAT_TO_GRAMS;
  const existingVnos = opts.existingVnos || new Set<string>();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    return { rows: [], errors: [{ row: 0, message: 'Sheet not found' }], warnings: [] };
  }

  const aoa = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 12); i++) {
    const cells = aoa[i] || [];
    const joined = cells.map(normHeader).join('|');
    if (joined.includes('customer_name') || joined.includes('အမည်')) {
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
      warnings: [],
    };
  }

  const headerMap = resolveHeaderMap(aoa[headerRowIdx] || []);
  if (![...headerMap.values()].includes('customer_name')) {
    return {
      rows: [],
      errors: [{ row: headerRowIdx + 1, message: 'customer_name / အမည် ကော်လံ လိုအပ်သည်' }],
      warnings: [],
    };
  }
  if (![...headerMap.values()].includes('vno')) {
    return {
      rows: [],
      errors: [{ row: headerRowIdx + 1, message: 'vno ကော်လံ လိုအပ်သည် (unique)' }],
      warnings: [],
    };
  }

  const rows: PawnImportRow[] = [];
  const errors: PawnImportIssue[] = [];
  const warnings: PawnImportIssue[] = [];
  const seenVno = new Set<string>();
  const seenTicket = new Set<string>();

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
    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];

    const vno = cellStr(obj.vno);
    const customer_name = cellStr(obj.customer_name);
    const customer_phone = cellStr(obj.customer_phone);
    const item_name = cellStr(obj.item_name);
    const ticket = cellStr(obj.pawn_ticket_no);

    if (!vno) rowErrors.push('vno လိုအပ်သည် (unique)');
    else {
      const key = vno.toLowerCase();
      if (seenVno.has(key)) rowErrors.push(`vno "${vno}" Excel ထဲ ထပ်နေသည်`);
      else if (existingVnos.has(key)) rowErrors.push(`vno "${vno}" database မှာ ရှိပြီးသား`);
      else seenVno.add(key);
    }
    if (ticket) {
      const tk = ticket.toLowerCase();
      if (seenTicket.has(tk)) rowErrors.push(`pawn_ticket_no "${ticket}" Excel ထဲ ထပ်နေသည်`);
      else seenTicket.add(tk);
    }
    if (!customer_name) rowErrors.push('အမည် လိုအပ်သည်');
    if (!customer_phone) rowErrors.push('ဖုန်း လိုအပ်သည်');
    if (!item_name) rowErrors.push('ပစ္စည်းအမည် လိုအပ်သည်');

    const startParsed = cellDateStrict(obj.start_date);
    let start_date = '';
    if (startParsed.status === 'empty') {
      rowErrors.push('ပေါင်ရက် (start_date) လိုအပ်သည်');
    } else if (startParsed.status === 'error') {
      rowErrors.push(
        `start_date "${startParsed.raw}" မမှန် — YYYY-MM-DD သို့မဟုတ် DD/MM/YYYY သုံးပါ`
      );
    } else {
      start_date = startParsed.iso;
      if (startParsed.convertedFrom) {
        rowWarnings.push(
          `start_date "${startParsed.convertedFrom}" → "${start_date}" (DB format) သို့ ပြောင်းပြီး`
        );
      }
    }

    const lastParsed = cellDateStrict(obj.last_interest_date);
    let last_interest_date = start_date;
    if (lastParsed.status === 'error') {
      rowErrors.push(
        `last_interest_date "${lastParsed.raw}" မမှန် — YYYY-MM-DD သို့မဟုတ် DD/MM/YYYY`
      );
    } else if (lastParsed.status === 'ok') {
      last_interest_date = lastParsed.iso;
      if (lastParsed.convertedFrom) {
        rowWarnings.push(
          `last_interest_date "${lastParsed.convertedFrom}" → "${last_interest_date}" သို့ ပြောင်းပြီး`
        );
      }
    }

    const gk = mapGoldKind(cellStr(obj.gold_kind));
    let gold_kind = 'MYANMAR';
    if (gk.ok === true) gold_kind = gk.value;
    else rowErrors.push(gk.message);

    const pu = mapPurity(cellStr(obj.purity), gold_kind);
    let purity: GoldPurity = 'MEELIN';
    if (pu.ok === true) purity = pu.value;
    else rowErrors.push(pu.message);

    const item_type = mapItemType(cellStr(obj.item_type));

    const gramsR = cellNumStrict(obj.weight_grams);
    const kyatR = cellNumStrict(obj.weight_kyat);
    const paeR = cellNumStrict(obj.weight_pae);
    const ywayR = cellNumStrict(obj.weight_yway);
    if (gramsR.ok === false) rowErrors.push(`weight_grams "${gramsR.raw}" ဂဏန်း မဟုတ်`);
    if (kyatR.ok === false) rowErrors.push(`weight_kyat "${kyatR.raw}" ဂဏန်း မဟုတ်`);
    if (paeR.ok === false) rowErrors.push(`weight_pae "${paeR.raw}" ဂဏန်း မဟုတ်`);
    if (ywayR.ok === false) rowErrors.push(`weight_yway "${ywayR.raw}" ဂဏန်း မဟုတ်`);

    let grams = gramsR.ok ? gramsR.value : 0;
    let kyat = kyatR.ok ? kyatR.value : 0;
    let pae = paeR.ok ? paeR.value : 0;
    let yway = ywayR.ok ? ywayR.value : 0;
    if (grams > 0 && kyat === 0 && pae === 0 && yway === 0) {
      const kpy = gramsToKpy(grams, kyatToGrams);
      kyat = kpy.kyat;
      pae = kpy.pae;
      yway = Number(kpy.yway.toFixed(3));
    } else if (grams <= 0 && (kyat > 0 || pae > 0 || yway > 0)) {
      grams = Number(((kyat + pae / 16 + yway / 128) * kyatToGrams).toFixed(4));
    }
    if (grams <= 0 && kyat <= 0 && pae <= 0 && yway <= 0) {
      rowErrors.push('အလေးချိန် (ဂရမ် သို့မဟုတ် ကျပ်/ပဲ/ရွေး) လိုအပ်သည်');
    }

    const loanR = cellNumStrict(obj.loan_amount);
    const loanBahtR = cellNumStrict(obj.loan_amount_baht);
    const rateR = cellNumStrict(obj.monthly_interest_rate);
    const lossR = cellNumStrict(obj.loss_months);
    if (loanR.ok === false) rowErrors.push(`loan_amount "${loanR.raw}" ဂဏန်း မဟုတ်`);
    if (loanBahtR.ok === false) rowErrors.push(`loan_amount_baht "${loanBahtR.raw}" ဂဏန်း မဟုတ်`);
    if (rateR.ok === false) rowErrors.push(`monthly_interest_rate "${rateR.raw}" ဂဏန်း မဟုတ်`);
    if (lossR.ok === false) rowErrors.push(`loss_months "${lossR.raw}" ဂဏန်း မဟုတ်`);

    const loan_amount = loanR.ok ? loanR.value : 0;
    const loan_amount_baht = loanBahtR.ok ? loanBahtR.value : 0;
    if (loan_amount <= 0 && loan_amount_baht <= 0) {
      rowErrors.push('ချေးငွေ ကျပ် သို့မဟုတ် ဘတ် လိုအပ်သည်');
    }

    const monthly_interest_rate = (rateR.ok && rateR.value > 0 ? rateR.value : 5) || 5;
    const loss_months = Math.max(1, lossR.ok && lossR.value > 0 ? lossR.value : 3);

    for (const m of rowErrors) errors.push({ row: excelRow, message: m });
    for (const m of rowWarnings) warnings.push({ row: excelRow, message: m });

    // Only build row payload when this row has no hard errors (batch still blocked if any errors exist)
    if (rowErrors.length > 0 || !start_date) continue;

    const due_date = addMonthsISO(last_interest_date, loss_months);
    const next_interest_date = addMonthsISO(last_interest_date, 1);
    const net = calculateNetWeight({ kyat, pae, yway }, 0, 0);
    const specific = opts.priceForPurity(purity);
    const val = calculateGoldValuation(net, purity, opts.pure16Price, specific);
    const principal = loan_amount_baht > 0 && loan_amount <= 0 ? loan_amount_baht : loan_amount;
    const accrued = Math.round((principal * monthly_interest_rate) / 100);

    rows.push({
      pawn_ticket_no: ticket || undefined,
      vno,
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
  }

  return { rows, errors, warnings };
}

export function makePawnTicketNo(startDate: string, index: number): string {
  const rand = Math.floor(100 + Math.random() * 900);
  return `PWN-${startDate.replace(/-/g, '')}-${rand}${index}`;
}

export function formatPawnImportIssues(issues: PawnImportIssue[], limit = 30): string {
  return issues
    .slice(0, limit)
    .map((e) => `Row ${e.row}: ${e.message}`)
    .join('\n');
}
