import { CellStore, coordsToRef, colNameToIndex } from './cell-store';

export class ImporterExporter {
  private store: CellStore;

  constructor(store: CellStore) {
    this.store = store;
  }

  /**
   * Exports a given sheet (or active sheet) to an RFC 4180 compliant CSV string.
   */
  public exportCSV(sheetId?: string, useFormulas = false): string {
    const sheet = sheetId ? this.store.getSheetById(sheetId) : this.store.getActiveSheet();
    if (!sheet) return '';

    // Find bounding box of non-empty cells
    let maxCol = 0;
    let maxRow = 0;

    for (const [ref, cell] of Object.entries(sheet.cells)) {
      if (cell && (cell.raw !== '' || cell.computed !== undefined)) {
        const match = ref.match(/^([A-Z]+)([0-9]+)$/);
        if (match) {
          const col = colNameToIndex(match[1]);
          const row = parseInt(match[2], 10) - 1;
          if (col > maxCol) maxCol = col;
          if (row > maxRow) maxRow = row;
        }
      }
    }

    const lines: string[] = [];
    for (let r = 0; r <= maxRow; r++) {
      const rowVals: string[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const ref = coordsToRef(c, r);
        const cell = sheet.cells[ref];
        let val = '';
        if (cell) {
          if (useFormulas && cell.raw.startsWith('=')) {
            val = cell.raw;
          } else if (cell.computed !== undefined && cell.computed !== null) {
            val = String(cell.computed);
          } else {
            val = cell.raw;
          }
        }
        rowVals.push(this.escapeCSVField(val));
      }
      lines.push(rowVals.join(','));
    }

    return lines.join('\r\n');
  }

  /**
   * Imports an RFC 4180 compliant CSV string into the target sheet.
   */
  public importCSV(csvContent: string, sheetId?: string, clearExisting = true): boolean {
    const sheet = sheetId ? this.store.getSheetById(sheetId) : this.store.getActiveSheet();
    if (!sheet) return false;

    const rows = this.parseCSV(csvContent);
    if (rows.length === 0) return false;

    this.store.recordHistory('Import CSV');

    if (clearExisting) {
      sheet.cells = {};
    }

    // Expand rows/cols if necessary
    sheet.rowCount = Math.max(sheet.rowCount, rows.length + 10);
    sheet.colCount = Math.max(sheet.colCount, Math.max(...rows.map((r) => r.length)) + 5);

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const val = row[c].trim();
        if (val !== '') {
          const ref = coordsToRef(c, r);
          this.store.setCellRaw(ref, val, sheet.id, false);
        }
      }
    }

    return true;
  }

  /**
   * RFC 4180 CSV Parser
   */
  public parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;
    const len = text.length;

    while (i < len) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            // Escaped quote ""
            currentField += '"';
            i += 2;
            continue;
          } else {
            // Closing quote
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          currentField += ch;
          i++;
          continue;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i++;
          continue;
        }

        if (ch === ',') {
          currentRow.push(currentField);
          currentField = '';
          i++;
          continue;
        }

        if (ch === '\r') {
          if (i + 1 < len && text[i + 1] === '\n') {
            i++;
          }
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          i++;
          continue;
        }

        if (ch === '\n') {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          i++;
          continue;
        }

        currentField += ch;
        i++;
      }
    }

    if (currentField !== '' || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    return rows;
  }

  /**
   * Exports selected range as TSV for clipboard
   */
  public exportTSV(startCol: number, startRow: number, endCol: number, endRow: number, sheetId?: string): string {
    const sheet = sheetId ? this.store.getSheetById(sheetId) : this.store.getActiveSheet();
    if (!sheet) return '';

    const lines: string[] = [];
    for (let r = startRow; r <= endRow; r++) {
      const rowVals: string[] = [];
      for (let c = startCol; c <= endCol; c++) {
        const ref = coordsToRef(c, r);
        const cell = sheet.cells[ref];
        rowVals.push(cell?.computed !== undefined ? String(cell.computed) : cell?.raw || '');
      }
      lines.push(rowVals.join('\t'));
    }
    return lines.join('\n');
  }

  /**
   * Pastes TSV from clipboard into spreadsheet at target coordinate
   */
  public pasteTSV(tsv: string, startCol: number, startRow: number, sheetId?: string): void {
    const lines = tsv.trim().split(/\r?\n/);
    if (lines.length === 0) return;

    this.store.recordHistory('Paste');
    const sheet = sheetId ? this.store.getSheetById(sheetId) : this.store.getActiveSheet();
    if (!sheet) return;

    for (let r = 0; r < lines.length; r++) {
      const cols = lines[r].split('\t');
      for (let c = 0; c < cols.length; c++) {
        const val = cols[c];
        const targetRef = coordsToRef(startCol + c, startRow + r);
        this.store.setCellRaw(targetRef, val, sheet.id, false);
      }
    }
  }

  private escapeCSVField(field: string): string {
    if (field.includes('"') || field.includes(',') || field.includes('\n') || field.includes('\r')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
}
