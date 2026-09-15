import * as XLSX from 'xlsx-js-style';

export type ExcelCellValue = string | number | boolean | null | undefined;

export type ExcelColumn<T> = {
  header: string;
  value: (row: T) => ExcelCellValue;
  width?: number;
};

type CellStyle = {
  font?: { bold?: boolean; color?: { rgb: string }; sz?: number; name?: string };
  fill?: { patternType: 'solid'; fgColor: { rgb: string } };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
  border?: Record<string, { style: string; color: { rgb: string } }>;
};

const HEADER_STYLE: CellStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
  fill: { patternType: 'solid', fgColor: { rgb: 'B8860B' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: '996515' } },
    bottom: { style: 'thin', color: { rgb: '996515' } },
    left: { style: 'thin', color: { rgb: '996515' } },
    right: { style: 'thin', color: { rgb: '996515' } },
  },
};

const BODY_BORDER = {
  top: { style: 'thin', color: { rgb: 'D2CBC0' } },
  bottom: { style: 'thin', color: { rgb: 'D2CBC0' } },
  left: { style: 'thin', color: { rgb: 'D2CBC0' } },
  right: { style: 'thin', color: { rgb: 'D2CBC0' } },
};

const BODY_STYLE: CellStyle = {
  font: { sz: 10, name: 'Calibri', color: { rgb: '1F2937' } },
  alignment: { vertical: 'center', wrapText: true },
  border: BODY_BORDER,
};

const ALT_FILL = { patternType: 'solid' as const, fgColor: { rgb: 'FAF8F2' } };

function stampDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'export';
}

/**
 * Export tabular data to a styled `.xlsx` file (xlsx-js-style).
 */
export function exportToExcel<T>(opts: {
  filename: string;
  sheetName?: string;
  columns: ExcelColumn<T>[];
  rows: T[];
  title?: string;
}): void {
  const { filename, sheetName = 'Sheet1', columns, rows, title } = opts;
  const wb = XLSX.utils.book_new();
  const aoa: ExcelCellValue[][] = [];

  if (title) {
    aoa.push([title]);
    aoa.push([`Exported: ${new Date().toLocaleString()}`]);
    aoa.push([]);
  }

  aoa.push(columns.map((c) => c.header));
  for (const row of rows) {
    aoa.push(columns.map((c) => {
      const v = c.value(row);
      return v == null ? '' : v;
    }));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const headerRowIndex = title ? 3 : 0;

  ws['!cols'] = columns.map((c) => ({ wch: c.width ?? 16 }));

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;

      if (title && R === 0) {
        cell.s = {
          font: { bold: true, sz: 14, color: { rgb: '996515' }, name: 'Calibri' },
          alignment: { horizontal: 'left', vertical: 'center' },
        };
        continue;
      }
      if (title && R === 1) {
        cell.s = {
          font: { sz: 9, color: { rgb: '6B7280' }, name: 'Calibri' },
        };
        continue;
      }
      if (R === headerRowIndex) {
        cell.s = HEADER_STYLE;
        continue;
      }
      if (R > headerRowIndex) {
        const zebra = (R - headerRowIndex) % 2 === 0;
        cell.s = {
          ...BODY_STYLE,
          fill: zebra ? ALT_FILL : undefined,
        };
      }
    }
  }

  if (title) {
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(columns.length - 1, 0) } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(columns.length - 1, 0) } },
    ];
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${sanitizeFilename(filename)}_${stampDate()}.xlsx`);
}
