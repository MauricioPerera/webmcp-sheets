import {
  WorkbookData,
  SheetData,
  CellData,
  CellFormat,
  CellCoord,
  CellRange,
  HistoryRecord,
} from './types';

export function colIndexToName(col: number): string {
  if (col < 0) return 'A';
  let name = '';
  let c = col;
  while (c >= 0) {
    name = String.fromCharCode((c % 26) + 65) + name;
    c = Math.floor(c / 26) - 1;
  }
  return name;
}

export function colNameToIndex(name: string): number {
  let index = 0;
  const s = name.toUpperCase().replace(/[^A-Z]/g, '');
  for (let i = 0; i < s.length; i++) {
    index = index * 26 + (s.charCodeAt(i) - 64);
  }
  return Math.max(0, index - 1);
}

export function coordsToRef(col: number, row: number): string {
  return `${colIndexToName(col)}${row + 1}`;
}

export function parseCellRef(ref: string): { sheetName?: string; col: number; row: number } {
  let sheetName: string | undefined;
  let cleanRef = ref.trim();

  if (cleanRef.includes('!')) {
    const parts = cleanRef.split('!');
    sheetName = parts[0].replace(/^['"]|['"]$/g, '');
    cleanRef = parts[1];
  }

  // Remove $ for absolute references e.g. $A$1
  cleanRef = cleanRef.replace(/\$/g, '');

  const match = cleanRef.match(/^([A-Za-z]+)([0-9]+)$/);
  if (!match) {
    return { sheetName, col: 0, row: 0 };
  }

  const col = colNameToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1;
  return { sheetName, col: Math.max(0, col), row: Math.max(0, row) };
}

export function parseRange(rangeStr: string): CellRange {
  let sheetName: string | undefined;
  let clean = rangeStr.trim();

  if (clean.includes('!')) {
    const parts = clean.split('!');
    sheetName = parts[0].replace(/^['"]|['"]$/g, '');
    clean = parts[1];
  }

  if (clean.includes(':')) {
    const [startRef, endRef] = clean.split(':');
    const start = parseCellRef(startRef);
    const end = parseCellRef(endRef);
    return {
      sheetName,
      startCol: Math.min(start.col, end.col),
      startRow: Math.min(start.row, end.row),
      endCol: Math.max(start.col, end.col),
      endRow: Math.max(start.row, end.row),
    };
  }

  const single = parseCellRef(clean);
  return {
    sheetName,
    startCol: single.col,
    startRow: single.row,
    endCol: single.col,
    endRow: single.row,
  };
}

export function getCellsInRange(range: CellRange): string[] {
  const refs: string[] = [];
  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      refs.push(coordsToRef(c, r));
    }
  }
  return refs;
}

export class CellStore {
  private workbook: WorkbookData;
  private undoStack: HistoryRecord[] = [];
  private redoStack: HistoryRecord[] = [];
  private maxHistory = 50;
  private listeners: Set<(event: string) => void> = new Set();
  private storageKey = 'webmcp_sheets_workbook_v1';

  constructor(initialData?: WorkbookData) {
    if (initialData) {
      this.workbook = JSON.parse(JSON.stringify(initialData));
    } else {
      this.workbook = this.createDefaultWorkbook();
    }
  }

  public createDefaultWorkbook(): WorkbookData {
    const sheet1Id = 'sheet_1';
    return {
      id: 'wb_' + Date.now(),
      title: 'Untitled Spreadsheet',
      activeSheetId: sheet1Id,
      sheets: [
        {
          id: sheet1Id,
          name: 'Sheet1',
          cells: {},
          rowCount: 100,
          colCount: 26,
        },
      ],
    };
  }

  public getWorkbook(): WorkbookData {
    return this.workbook;
  }

  public getTitle(): string {
    return this.workbook.title;
  }

  public setTitle(title: string): void {
    this.recordHistory(`Rename document to "${title}"`);
    this.workbook.title = title;
    this.notify('title_change');
  }

  public getSheets(): SheetData[] {
    return this.workbook.sheets;
  }

  public getActiveSheet(): SheetData {
    const sheet = this.workbook.sheets.find((s) => s.id === this.workbook.activeSheetId);
    if (!sheet) {
      return this.workbook.sheets[0];
    }
    return sheet;
  }

  public getSheetById(id: string): SheetData | undefined {
    return this.workbook.sheets.find((s) => s.id === id);
  }

  public getSheetByName(name: string): SheetData | undefined {
    return this.workbook.sheets.find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
  }

  public setActiveSheet(sheetId: string): void {
    const exists = this.workbook.sheets.some((s) => s.id === sheetId);
    if (exists && this.workbook.activeSheetId !== sheetId) {
      this.workbook.activeSheetId = sheetId;
      this.notify('sheet_change');
    }
  }

  public addSheet(name?: string): SheetData {
    this.recordHistory('Add sheet');
    const index = this.workbook.sheets.length + 1;
    const sheetName = name || `Sheet${index}`;
    const newSheet: SheetData = {
      id: `sheet_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: sheetName,
      cells: {},
      rowCount: 100,
      colCount: 26,
    };
    this.workbook.sheets.push(newSheet);
    this.workbook.activeSheetId = newSheet.id;
    this.notify('sheet_added');
    return newSheet;
  }

  public renameSheet(sheetId: string, newName: string): boolean {
    const sheet = this.getSheetById(sheetId);
    if (!sheet || !newName.trim()) return false;
    const nameConflict = this.workbook.sheets.some(
      (s) => s.id !== sheetId && s.name.toLowerCase() === newName.trim().toLowerCase()
    );
    if (nameConflict) return false;

    this.recordHistory(`Rename sheet to "${newName}"`);
    sheet.name = newName.trim();
    this.notify('sheet_renamed');
    return true;
  }

  public deleteSheet(sheetId: string): boolean {
    if (this.workbook.sheets.length <= 1) return false;
    const index = this.workbook.sheets.findIndex((s) => s.id === sheetId);
    if (index === -1) return false;

    this.recordHistory('Delete sheet');
    this.workbook.sheets.splice(index, 1);
    if (this.workbook.activeSheetId === sheetId) {
      this.workbook.activeSheetId = this.workbook.sheets[Math.max(0, index - 1)].id;
    }
    this.notify('sheet_deleted');
    return true;
  }

  public duplicateSheet(sheetId: string, name: string): SheetData | undefined {
    const source = this.getSheetById(sheetId);
    const trimmed = name.trim();
    if (!source || !trimmed || this.getSheetByName(trimmed)) return undefined;
    this.recordHistory('Duplicate sheet');
    const duplicate: SheetData = JSON.parse(JSON.stringify(source));
    duplicate.id = `sheet_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    duplicate.name = trimmed;
    this.workbook.sheets.push(duplicate);
    this.workbook.activeSheetId = duplicate.id;
    this.notify('sheet_added');
    return duplicate;
  }

  public getCell(refOrCoord: string | CellCoord, sheetId?: string): CellData | undefined {
    const sheet = sheetId ? this.getSheetById(sheetId) : this.getActiveSheet();
    if (!sheet) return undefined;
    const key = typeof refOrCoord === 'string'
      ? refOrCoord.toUpperCase()
      : coordsToRef(refOrCoord.col, refOrCoord.row);
    return sheet.cells[key];
  }

  public setCell(
    refOrCoord: string | CellCoord,
    cellData: Partial<CellData>,
    sheetId?: string,
    recordUndo = true
  ): void {
    const sheet = sheetId ? this.getSheetById(sheetId) : this.getActiveSheet();
    if (!sheet) return;

    if (recordUndo) {
      this.recordHistory('Update cell');
    }

    const key = typeof refOrCoord === 'string'
      ? refOrCoord.toUpperCase()
      : coordsToRef(refOrCoord.col, refOrCoord.row);

    const existing = sheet.cells[key] || { raw: '' };
    sheet.cells[key] = {
      ...existing,
      ...cellData,
      format: {
        ...(existing.format || {}),
        ...(cellData.format || {}),
      },
    };

    this.notify('cell_change');
  }

  public setCellRaw(
    refOrCoord: string | CellCoord,
    rawValue: string,
    sheetId?: string,
    recordUndo = true
  ): void {
    this.setCell(
      refOrCoord,
      { raw: rawValue, computed: undefined, error: null },
      sheetId,
      recordUndo
    );
  }

  public setCellFormat(
    refOrCoord: string | CellCoord,
    format: Partial<CellFormat>,
    sheetId?: string
  ): void {
    const sheet = sheetId ? this.getSheetById(sheetId) : this.getActiveSheet();
    if (!sheet) return;

    this.recordHistory('Update formatting');
    const key = typeof refOrCoord === 'string'
      ? refOrCoord.toUpperCase()
      : coordsToRef(refOrCoord.col, refOrCoord.row);

    const existing = sheet.cells[key] || { raw: '' };
    sheet.cells[key] = {
      ...existing,
      format: {
        ...(existing.format || {}),
        ...format,
      },
    };
    this.notify('format_change');
  }

  public setRangeFormat(range: CellRange, format: Partial<CellFormat>, sheetId?: string): void {
    this.recordHistory('Format range');
    const refs = getCellsInRange(range);
    refs.forEach((ref) => {
      this.setCell(ref, { format }, sheetId, false);
    });
    this.notify('format_change');
  }

  public clearRange(range: CellRange, sheetId?: string): void {
    this.recordHistory('Clear range');
    const sheet = sheetId ? this.getSheetById(sheetId) : this.getActiveSheet();
    if (!sheet) return;

    const refs = getCellsInRange(range);
    refs.forEach((ref) => {
      delete sheet.cells[ref];
    });
    this.notify('cell_change');
  }

  public recordHistory(description = 'Edit'): void {
    const snapshot: HistoryRecord = {
      workbook: JSON.parse(JSON.stringify(this.workbook)),
      description,
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public undo(): boolean {
    if (this.undoStack.length === 0) return false;
    const currentSnapshot: HistoryRecord = {
      workbook: JSON.parse(JSON.stringify(this.workbook)),
      description: 'Current',
    };
    this.redoStack.push(currentSnapshot);

    const previous = this.undoStack.pop()!;
    this.workbook = previous.workbook;
    this.notify('undo');
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const currentSnapshot: HistoryRecord = {
      workbook: JSON.parse(JSON.stringify(this.workbook)),
      description: 'Current',
    };
    this.undoStack.push(currentSnapshot);

    const next = this.redoStack.pop()!;
    this.workbook = next.workbook;
    this.notify('redo');
    return true;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public saveToLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.workbook));
    } catch (e) {
      console.warn('Unable to save to localStorage:', e);
    }
  }

  public loadFromLocalStorage(): boolean {
    if (typeof localStorage === 'undefined') return false;
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        if (isValidWorkbook(parsed)) {
          this.workbook = parsed;
          this.undoStack = [];
          this.redoStack = [];
          this.notify('loaded');
          return true;
        }
      }
    } catch (e) {
      console.warn('Unable to load from localStorage:', e);
    }
    return false;
  }

  public exportJSON(): string {
    return JSON.stringify(this.workbook, null, 2);
  }

  public importJSON(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (isValidWorkbook(parsed)) {
        this.recordHistory('Import JSON');
        this.workbook = parsed;
        this.notify('loaded');
        return true;
      }
    } catch (e) {
      console.error('Failed to import JSON:', e);
    }
    return false;
  }

  public subscribe(fn: (event: string) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(event: string): void {
    this.saveToLocalStorage();
    this.listeners.forEach((fn) => fn(event));
  }
}

function isValidWorkbook(value: unknown): value is WorkbookData {
  if (!value || typeof value !== 'object') return false;
  const workbook = value as Partial<WorkbookData>;
  if (typeof workbook.id !== 'string' || typeof workbook.title !== 'string' ||
      typeof workbook.activeSheetId !== 'string' || !Array.isArray(workbook.sheets) ||
      workbook.sheets.length === 0) return false;
  if (!workbook.sheets.every((sheet) => {
    if (!sheet || typeof sheet !== 'object') return false;
    const s = sheet as Partial<SheetData>;
    if (typeof s.id !== 'string' || typeof s.name !== 'string' ||
        !s.cells || typeof s.cells !== 'object' || typeof s.rowCount !== 'number' ||
        typeof s.colCount !== 'number') return false;
    return Object.entries(s.cells).every(([ref, cell]) =>
      /^[A-Z]+[1-9][0-9]*$/.test(ref) && !!cell && typeof cell.raw === 'string');
  })) return false;
  return workbook.sheets.some((sheet) => sheet.id === workbook.activeSheetId);
}
