import { describe, it, expect, beforeEach } from 'vitest';
import { CellStore } from '../src/core/cell-store';
import { ImporterExporter } from '../src/core/importer-exporter';

describe('ImporterExporter (CSV & TSV)', () => {
  let store: CellStore;
  let io: ImporterExporter;

  beforeEach(() => {
    store = new CellStore();
    io = new ImporterExporter(store);
  });

  it('exports and parses RFC 4180 CSV with quotes, commas and multi-lines', () => {
    const rawCSV = 'Name,Description,Price\r\n"Widget, Deluxe","High quality, multi-line\r\nspec",99.95';
    const parsed = io.parseCSV(rawCSV);

    expect(parsed.length).toBe(2);
    expect(parsed[0]).toEqual(['Name', 'Description', 'Price']);
    expect(parsed[1][0]).toBe('Widget, Deluxe');
    expect(parsed[1][1]).toBe('High quality, multi-line\r\nspec');
    expect(parsed[1][2]).toBe('99.95');
  });

  it('imports CSV into spreadsheet and exports it back', () => {
    const csvData = 'Item,Qty,Price\nLaptop,5,1200\nMouse,20,25';
    const ok = io.importCSV(csvData);
    expect(ok).toBe(true);

    expect(store.getCell('A1')?.raw).toBe('Item');
    expect(store.getCell('B1')?.raw).toBe('Qty');
    expect(store.getCell('C1')?.raw).toBe('Price');
    expect(store.getCell('A2')?.raw).toBe('Laptop');
    expect(store.getCell('B2')?.raw).toBe('5');
    expect(store.getCell('C2')?.raw).toBe('1200');

    const exported = io.exportCSV();
    expect(exported).toContain('Laptop');
    expect(exported).toContain('Mouse');
  });

  it('exports and pastes TSV format for clipboard integration', () => {
    store.setCellRaw('A1', 'Alpha');
    store.setCellRaw('B1', 'Beta');
    store.setCellRaw('A2', 'Gamma');
    store.setCellRaw('B2', 'Delta');

    const tsv = io.exportTSV(0, 0, 1, 1);
    expect(tsv).toBe('Alpha\tBeta\nGamma\tDelta');

    // Paste into a new location (C3 -> col 2, row 2)
    io.pasteTSV('X\tY\nZ\tW', 2, 2);
    expect(store.getCell('C3')?.raw).toBe('X');
    expect(store.getCell('D3')?.raw).toBe('Y');
    expect(store.getCell('C4')?.raw).toBe('Z');
    expect(store.getCell('D4')?.raw).toBe('W');
  });
});
