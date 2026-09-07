import { describe, it, expect, beforeEach } from 'vitest';
import { CellStore } from '../src/core/cell-store';
import { FormulaEngine } from '../src/core/formula-engine';
import { DependencyGraph } from '../src/core/dependency-graph';
import { ImporterExporter } from '../src/core/importer-exporter';
import { WebMcpService } from '../src/core/webmcp-service';
import { HtmxRouter } from '../src/ui/htmx-router';

describe('HtmxRouter (Client-Side Hypermedia)', () => {
  let store: CellStore;
  let engine: FormulaEngine;
  let dag: DependencyGraph;
  let io: ImporterExporter;
  let webmcp: WebMcpService;
  let router: HtmxRouter;

  beforeEach(() => {
    store = new CellStore();
    engine = new FormulaEngine(store);
    dag = new DependencyGraph(store, engine);
    io = new ImporterExporter(store);
    webmcp = new WebMcpService(store, engine, dag, io);
    router = new HtmxRouter(store, webmcp, io);
  });

  it('renders Find and Replace modal partial', () => {
    const html = router.renderRoute('/modal/find-replace');
    expect(html).toContain('Find and replace');
    expect(html).toContain('id="find-input"');
    expect(html).toContain('id="replace-input"');
  });

  it('renders Functions modal partial with categories and examples', () => {
    const html = router.renderRoute('/modal/functions');
    expect(html).toContain('Function reference');
    expect(html).toContain('SUM');
    expect(html).toContain('VLOOKUP');
  });

  it('renders Export modal partial with CSV and JSON options', () => {
    const html = router.renderRoute('/modal/export');
    expect(html).toContain('Export Spreadsheet');
    expect(html).toContain('CSV format');
    expect(html).toContain('JSON workbook');
  });

  it('renders Import modal partial', () => {
    const html = router.renderRoute('/modal/import');
    expect(html).toContain('Import CSV');
    expect(html).toContain('import-file-input');
  });

  it('renders Keyboard Shortcuts modal partial', () => {
    const html = router.renderRoute('/modal/shortcuts');
    expect(html).toContain('Keyboard Shortcuts');
    expect(html).toContain('Ctrl + Z');
  });

  it('renders WebMCP information panel partial', () => {
    const html = router.renderRoute('/panel/webmcp-info');
    expect(html).toContain('WebMCP & fastwebmcp Architecture');
    expect(html).toContain('sheets_get_cell');
    expect(html).toContain('webmcp.com');
  });
});
