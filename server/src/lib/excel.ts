import ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  type?: 'text' | 'number' | 'percent' | 'date' | 'boolean';
}

export interface ExcelSheet {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, any>[];
}

// ── Single sheet (backward compatible) ──
export async function generateExcelBuffer(
  sheetName: string,
  columns: ExcelColumn[],
  rows: Record<string, any>[]
): Promise<Buffer> {
  return generateMultiSheetExcelBuffer([{ name: sheetName, columns, rows }]);
}

// ── Multi-sheet professional workbook ──
export async function generateMultiSheetExcelBuffer(
  sheets: ExcelSheet[],
  meta?: { title?: string; appliedFilters?: string; exportedAt?: Date }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TERMINAL Administration Platform';
  workbook.created = meta?.exportedAt || new Date();
  workbook.properties.date1904 = false;

  // Header style constants
  const HEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F131D' },
  };
  const HEADER_FONT: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: 'FF00E5FF' },
    size: 10,
    name: 'Courier New',
  };
  const DATA_FONT: Partial<ExcelJS.Font> = {
    size: 10,
    name: 'Courier New',
  };
  const ALT_ROW_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0B0F17' },
  };

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31));

    ws.columns = sheet.columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || Math.max(col.header.length + 4, 16),
    }));

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font = HEADER_FONT;
    headerRow.fill = HEADER_FILL;
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    headerRow.height = 22;
    headerRow.eachCell(cell => {
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF00E5FF' } },
      };
    });

    // Freeze header
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Enable autoFilter on the header row
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };

    // Add data rows
    for (let i = 0; i < sheet.rows.length; i++) {
      const item = sheet.rows[i];
      const rowValues: Record<string, any> = {};

      for (const col of sheet.columns) {
        let val = item[col.key];
        if (val === null || val === undefined) {
          rowValues[col.key] = '';
          continue;
        }
        if (col.type === 'date' && val instanceof Date) {
          rowValues[col.key] = val.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
        } else if (col.type === 'date' && typeof val === 'string') {
          rowValues[col.key] = val.replace('T', ' ').slice(0, 19) + ' UTC';
        } else if (col.type === 'percent') {
          rowValues[col.key] = typeof val === 'number' ? `${val}%` : val;
        } else if (col.type === 'boolean') {
          rowValues[col.key] = val ? 'YES' : 'NO';
        } else if (col.type === 'number') {
          rowValues[col.key] = typeof val === 'number' ? val : Number(val) || 0;
        } else if (typeof val === 'object') {
          const str = JSON.stringify(val);
          rowValues[col.key] = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
        } else {
          const str = String(val);
          // Protect against CSV / Excel formula injection for user-controlled strings
          rowValues[col.key] = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
        }
      }

      const row = ws.addRow(rowValues);
      row.font = DATA_FONT;
      row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
      row.height = 18;

      // Alternate row background
      if (i % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = ALT_ROW_FILL;
        });
      }
    }

    // Add metadata note at end if provided
    if (meta?.appliedFilters && sheet === sheets[0]) {
      ws.addRow({});
      const noteRow = ws.addRow({ [sheet.columns[0].key]: `EXPORTED: ${(meta.exportedAt || new Date()).toISOString()} | FILTERS: ${meta.appliedFilters}` });
      noteRow.font = { italic: true, size: 9, color: { argb: 'FF94A3B8' }, name: 'Courier New' };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
