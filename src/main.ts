import { CellStore } from './core/cell-store';
import { FormulaEngine } from './core/formula-engine';
import { DependencyGraph } from './core/dependency-graph';
import { ImporterExporter } from './core/importer-exporter';
import { WebMcpService } from './core/webmcp-service';
import { HtmxRouter } from './ui/htmx-router';
import { SpreadsheetGrid } from './ui/grid';
import { FormulaBar } from './ui/formula-bar';
import { Toolbar } from './ui/toolbar';
import { MenuBar } from './ui/menu-bar';
import { SheetTabs } from './ui/sheet-tabs';
import { AgentDrawer } from './ui/agent-drawer';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Core Services Initialization
  const store = new CellStore();
  const engine = new FormulaEngine(store);
  const dag = new DependencyGraph(store, engine);
  const io = new ImporterExporter(store);
  const webmcp = new WebMcpService(store, engine, dag, io);
  const router = new HtmxRouter(store, webmcp, io);

  // 2. Load persisted workbook or populate sample demo data
  const hasLoaded = store.loadFromLocalStorage();
  if (!hasLoaded) {
    populateSampleData(store, dag);
  } else {
    dag.recalculateAll();
  }

  // 3. UI Modules Initialization
  const grid = new SpreadsheetGrid('grid-container', store, dag, io);
  const formulaBar = new FormulaBar('formula-bar-container', store, dag, grid);
  const toolbar = new Toolbar('toolbar-container', store, grid, dag);
  const menuBar = new MenuBar('menu-bar-container', store, io, grid, dag);
  const sheetTabs = new SheetTabs('sheet-tabs-container', store);
  const agentDrawer = new AgentDrawer('agent-drawer-container', webmcp, store, dag, grid);

  // 4. Synchronize Grid with Formula Bar & Status Bar
  grid.onSelectionChange((coord, range) => {
    formulaBar.updateActiveCell(coord);
    sheetTabs.updateSelectionStats(range);
  });

  grid.onCellEdit((val) => {
    formulaBar.setInputValue(val);
  });

  // 5. Connect Modal Actions (Find/Replace, CSV Import/Export)
  setupModalDelegations(store, dag, io, grid);

  // 6. Connect Declarative WebMCP Form
  const declarativeForm = document.querySelector('form[toolname="sheets_quick_entry"]') as HTMLFormElement;
  if (declarativeForm) {
    webmcp.defineDeclarativeTool(declarativeForm, {
      name: 'sheets_quick_entry',
      description: 'Fast entry of cell text or formula into active spreadsheet',
      fields: [
        { name: 'cell', description: 'Target cell coordinate' },
        { name: 'value', description: 'Value or formula starting with =' },
      ],
    });

    declarativeForm.addEventListener('submit', (e) => {
      webmcp.respondToAgentSubmit(e, (evt: any) => {
        const formData = new FormData(evt.target);
        const cell = String(formData.get('cell') || 'A1');
        const value = String(formData.get('value') || '');
        store.setCellRaw(cell, value);
        dag.updateCellDependencies(cell, value);
        dag.recalculate(cell);
        grid.render();
        return { success: true, cell, value };
      });
    });
  }

  // Initial update
  formulaBar.updateActiveCell(grid.getActiveCoord());
  sheetTabs.updateSelectionStats(grid.getSelectionRange());
});

function populateSampleData(store: CellStore, dag: DependencyGraph): void {
  const sheet = store.getActiveSheet();
  store.setTitle('Company Financials 2026');

  const headers = ['Quarter', 'Revenue ($)', 'Expenses ($)', 'Operating Income', 'Margin %'];
  headers.forEach((h, c) => {
    const ref = `${String.fromCharCode(65 + c)}1`;
    store.setCell(ref, {
      raw: h,
      format: { bold: true, bgColor: '#e6f4ea', textColor: '#137333', align: 'center' },
    });
  });

  const data = [
    ['Q1 2026', '125000', '82000', '=B2-C2', '=D2/B2'],
    ['Q2 2026', '148000', '89000', '=B3-C3', '=D3/B3'],
    ['Q3 2026', '162000', '94000', '=B4-C4', '=D4/B4'],
    ['Q4 2026 (Est)', '185000', '102000', '=B5-C5', '=D5/B5'],
    ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=D6/B6'],
  ];

  data.forEach((row, r) => {
    const rowIdx = r + 2;
    row.forEach((val, c) => {
      const ref = `${String.fromCharCode(65 + c)}${rowIdx}`;
      const isTotal = r === data.length - 1;
      const format: any = {};

      if (isTotal) {
        format.bold = true;
        format.bgColor = '#f8f9fa';
      }

      if (c >= 1 && c <= 3) {
        format.numberFormat = 'currency';
        format.decimals = 2;
      } else if (c === 4) {
        format.numberFormat = 'percent';
        format.decimals = 1;
      }

      store.setCell(ref, { raw: val, format }, sheet.id, false);
      dag.updateCellDependencies(ref, val, sheet.id);
    });
  });

  dag.recalculateAll();
}

function setupModalDelegations(
  store: CellStore,
  dag: DependencyGraph,
  io: ImporterExporter,
  grid: SpreadsheetGrid
): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Find & Replace Execute
    if (target.id === 'btn-do-replace') {
      const findVal = (document.getElementById('find-input') as HTMLInputElement)?.value;
      const replaceVal = (document.getElementById('replace-input') as HTMLInputElement)?.value;
      const matchCase = (document.getElementById('match-case') as HTMLInputElement)?.checked;

      if (findVal) {
        const sheet = store.getActiveSheet();
        for (const [ref, cell] of Object.entries(sheet.cells)) {
          const raw = cell.raw;
          const regex = new RegExp(
            findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            matchCase ? 'g' : 'gi'
          );
          if (regex.test(raw)) {
            const updated = raw.replace(regex, replaceVal);
            store.setCellRaw(ref, updated, sheet.id, false);
            dag.updateCellDependencies(ref, updated, sheet.id);
          }
        }
        dag.recalculateAll();
        grid.render();
        document.getElementById('modal-backdrop')?.remove();
      }
    }

    // Export CSV Download
    if (target.closest('#export-csv-btn')) {
      const csv = io.exportCSV();
      downloadFile(csv, `${store.getTitle()}.csv`, 'text/csv');
    }

    // Export JSON Download
    if (target.closest('#export-json-btn')) {
      const json = store.exportJSON();
      downloadFile(json, `${store.getTitle()}.json`, 'application/json');
    }

    // Import File Confirmation
    if (target.id === 'btn-do-import') {
      const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
      const rawText = (document.getElementById('import-raw-textarea') as HTMLTextAreaElement)?.value;

      if (fileInput?.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          const content = String(evt.target?.result || '');
          if (file.name.endsWith('.json')) {
            store.importJSON(content);
          } else {
            io.importCSV(content);
          }
          dag.recalculateAll();
          grid.render();
          document.getElementById('modal-backdrop')?.remove();
        };
        reader.readAsText(file);
      } else if (rawText && rawText.trim() !== '') {
        io.importCSV(rawText);
        dag.recalculateAll();
        grid.render();
        document.getElementById('modal-backdrop')?.remove();
      }
    }
  });
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
