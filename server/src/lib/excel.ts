import ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export async function generateExcelBuffer(
  sheetName: string,
  columns: ExcelColumn[],
  rows: Record<string, any>[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TERMINAL Administration Platform';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));

  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(col.header.length + 5, 18),
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF14151B' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 24;

  // Add data rows
  for (const item of rows) {
    const rowValues: Record<string, any> = {};
    for (const col of columns) {
      let val = item[col.key];
      if (val instanceof Date) {
        val = val.toISOString();
      } else if (typeof val === 'boolean') {
        val = val ? 'TRUE' : 'FALSE';
      } else if (typeof val === 'object' && val !== null) {
        val = JSON.stringify(val);
      }
      rowValues[col.key] = val !== undefined && val !== null ? val : '';
    }
    const row = worksheet.addRow(rowValues);
    row.alignment = { vertical: 'middle', horizontal: 'left' };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
