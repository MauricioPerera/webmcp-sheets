import { describe, it, expect } from 'vitest';
import {
  CellStore,
  colIndexToName,
  colNameToIndex,
  coordsToRef,
  parseCellRef,
  parseRange,
  getCellsInRange,
} from '../src/core/cell-store';

describe('CellStore & Coordinates', () => {
  it('converts column index to letters and back', () => {
    expect(colIndexToName(0)).toBe('A');
    expect(colIndexToName(1)).toBe('B');
    expect(colIndexToName(25)).toBe('Z');
    expect(colIndexToName(26)).toBe('AA');
    expect(colIndexToName(27)).toBe('AB');

    expect(colNameToIndex('A')).toBe(0);
    expect(colNameToIndex('B')).toBe(1);
    expect(colNameToIndex('Z')).toBe(25);
    expect(colNameToIndex('AA')).toBe(26);
    expect(colNameToIndex('AB')).toBe(27);
  });

  it('formats coordinates to reference strings', () => {
    expect(coordsToRef(0, 0)).toBe('A1');
    expect(coordsToRef(1, 2)).toBe('B3');
    expect(coordsToRef(25, 99)).toBe('Z100');
  });

  it('parses cell reference strings with optional sheet name and dollar signs', () => {
    expect(parseCellRef('A1')).toEqual({ sheetName: undefined, col: 0, row: 0 });
    expect(parseCellRef('$B$5')).toEqual({ sheetName: undefined, col: 1, row: 4 });
    expect(parseCellRef('Sheet2!C10')).toEqual({ sheetName: 'Sheet2', col: 2, row: 9 });
    expect(parseCellRef("'My Sheet'!D4")).toEqual({ sheetName: 'My Sheet', col: 3, row: 3 });
  });

  it('parses ranges and expands all cells', () => {
    const range = parseRange('A1:B2');
    expect(range).toEqual({
      sheetName: undefined,
      startCol: 0,
      startRow: 0,
      endCol: 1,
      endRow: 1,
    });
    const cells = getCellsInRange(range);
    expect(cells).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('manages workbook sheets lifecycle (add, rename, delete)', () => {
    const store = new CellStore();
    expect(store.getSheets().length).toBe(1);
    expect(store.getActiveSheet().name).toBe('Sheet1');

    const sheet2 = store.addSheet('Expenses');
    expect(store.getSheets().length).toBe(2);
    expect(store.getActiveSheet().name).toBe('Expenses');

    store.renameSheet(sheet2.id, 'Financials');
    expect(store.getSheetById(sheet2.id)?.name).toBe('Financials');

    const deleted = store.deleteSheet(sheet2.id);
    expect(deleted).toBe(true);
    expect(store.getSheets().length).toBe(1);

    // Cannot delete the only remaining sheet
    const deletedOnly = store.deleteSheet(store.getActiveSheet().id);
    expect(deletedOnly).toBe(false);
  });

  it('sets cell values, formats, and supports undo/redo', () => {
    const store = new CellStore();
    store.setCellRaw('A1', '100');
    expect(store.getCell('A1')?.raw).toBe('100');

    store.setCellFormat('A1', { bold: true, textColor: '#ff0000' });
    expect(store.getCell('A1')?.format?.bold).toBe(true);
    expect(store.getCell('A1')?.format?.textColor).toBe('#ff0000');

    store.undo(); // undo formatting
    expect(store.getCell('A1')?.format?.bold).toBeUndefined();

    store.redo(); // redo formatting
    expect(store.getCell('A1')?.format?.bold).toBe(true);
  });
});
