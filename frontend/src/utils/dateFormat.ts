/** Display dates as dd/mm/yyyy. Storage / APIs stay ISO yyyy-mm-dd. */

export function formatDate(value?: string | Date | null): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const s = value.trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (dmy) {
      const dd = dmy[1].padStart(2, '0');
      const mm = dmy[2].padStart(2, '0');
      return `${dd}/${mm}/${dmy[3]}`;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTime(value?: string | Date | null): string {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return formatDate(value);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hh}:${mi}`;
}

/** Calendar-day difference: today − date (local). */
export function calendarDaysSince(value?: string | Date | null): number | null {
  if (value == null || value === '') return null;
  let y: number;
  let m: number;
  let d: number;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    y = value.getFullYear();
    m = value.getMonth() + 1;
    d = value.getDate();
  } else {
    const s = String(value).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!iso) {
      const parsed = new Date(s);
      if (Number.isNaN(parsed.getTime())) return null;
      y = parsed.getFullYear();
      m = parsed.getMonth() + 1;
      d = parsed.getDate();
    } else {
      y = Number(iso[1]);
      m = Number(iso[2]);
      d = Number(iso[3]);
    }
  }
  const start = new Date(y, m - 1, d);
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

/** Today as ISO yyyy-mm-dd for APIs / date inputs. */
export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Inclusive from/to filter on ISO or datetime strings (compares yyyy-mm-dd). */
export function inDateRange(
  value: string | Date | null | undefined,
  from: string,
  to: string
): boolean {
  let d = '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    d = `${yyyy}-${mm}-${dd}`;
  } else if (typeof value === 'string') {
    d = String(value).trim().slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/** Parse dd/mm/yyyy, dd-mm-yyyy, or yyyy-mm-dd → ISO yyyy-mm-dd (or '' if invalid). */
export function parseDateToISO(raw?: string | null): string {
  if (raw == null) return '';
  const s = raw.trim();
  if (!s) return '';

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (isValidYmd(y, m, d)) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return '';
  }

  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    if (isValidYmd(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return '';
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
