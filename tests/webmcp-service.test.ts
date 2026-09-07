import { describe, it, expect, beforeEach } from 'vitest';
import { CellStore } from '../src/core/cell-store';
import { FormulaEngine } from '../src/core/formula-engine';
import { DependencyGraph } from '../src/core/dependency-graph';
import { ImporterExporter } from '../src/core/importer-exporter';
import { WebMcpService } from '../src/core/webmcp-service';

describe('WebMcpService (FastWebMCP & webmcp.com standards)', () => {
  let store: CellStore;
  let engine: FormulaEngine;
  let dag: DependencyGraph;
  let io: ImporterExporter;
  let webmcp: WebMcpService;

  beforeEach(() => {
    store = new CellStore();
    engine = new FormulaEngine(store);
    dag = new DependencyGraph(store, engine);
    io = new ImporterExporter(store);
    webmcp = new WebMcpService(store, engine, dag, io);
  });

  it('registers all 12 core non-overlapping WebMCP spreadsheet tools', () => {
    const tools = webmcp.getRegisteredTools();
    expect(tools.length).toBe(12);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('sheets_get_cell');
    expect(toolNames).toContain('sheets_set_cell');
    expect(toolNames).toContain('sheets_get_range');
    expect(toolNames).toContain('sheets_set_range');
    expect(toolNames).toContain('sheets_evaluate_formula');
    expect(toolNames).toContain('sheets_clear_range');
    expect(toolNames).toContain('sheets_create_sheet');
    expect(toolNames).toContain('sheets_delete_sheet');
    expect(toolNames).toContain('sheets_list_sheets');
    expect(toolNames).toContain('sheets_find_replace');
    expect(toolNames).toContain('sheets_export_data');
    expect(toolNames).toContain('sheets_get_summary');
  });

  it('executes sheets_set_cell and sheets_get_cell', async () => {
    await webmcp.executeTool('sheets_set_cell', {
      cell: 'B2',
      value: '42',
      format: { bold: true },
    });

    const res = (await webmcp.executeTool('sheets_get_cell', { cell: 'B2' })) as any;
    expect(res.cell).toBe('B2');
    expect(res.raw).toBe('42');
    expect(res.value).toBe(42);
    expect(res.format.bold).toBe(true);
  });

  it('executes batch sheets_set_range and sheets_get_range', async () => {
    await webmcp.executeTool('sheets_set_range', {
      startCell: 'A1',
      values: [
        ['Item', 'Cost'],
        ['Book', '15'],
        ['Pen', '2'],
      ],
    });

    const rangeRes = (await webmcp.executeTool('sheets_get_range', { range: 'A1:B3' })) as any;
    expect(rangeRes.matrix.length).toBe(3);
    expect(rangeRes.matrix[0][0].raw).toBe('Item');
    expect(rangeRes.matrix[1][1].raw).toBe('15');
  });

  it('evaluates arbitrary formulas via sheets_evaluate_formula', async () => {
    const res = (await webmcp.executeTool('sheets_evaluate_formula', {
      formula: '=SUM(10, 20, 30)',
    })) as any;
    expect(res.result).toBe(60);
  });

  it('manages sheets and summaries via WebMCP', async () => {
    await webmcp.executeTool('sheets_create_sheet', { name: 'Analytics' });
    const list = (await webmcp.executeTool('sheets_list_sheets', {})) as any;
    expect(list.sheets.some((s: any) => s.name === 'Analytics')).toBe(true);

    const summary = (await webmcp.executeTool('sheets_get_summary', { sheet: 'Sheet1' })) as any;
    expect(summary.sheet).toBe('Sheet1');
  });

  it('tracks execution logs for audit and agent feedback', async () => {
    await webmcp.executeTool('sheets_set_cell', { cell: 'A1', value: 'Test' });
    const logs = webmcp.getExecutionLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[logs.length - 1].toolName).toBe('sheets_set_cell');
    expect(logs[logs.length - 1].status).toBe('success');
  });
});
