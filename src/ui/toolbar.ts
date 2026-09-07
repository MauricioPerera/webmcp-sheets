import { CellStore, coordsToRef } from '../core/cell-store';
import { SpreadsheetGrid } from './grid';
import { DependencyGraph } from '../core/dependency-graph';

export class Toolbar {
  private container: HTMLElement;
  private store: CellStore;
  private grid: SpreadsheetGrid;
  private dag: DependencyGraph;

  constructor(
    containerId: string,
    store: CellStore,
    grid: SpreadsheetGrid,
    dag: DependencyGraph
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.store = store;
    this.grid = grid;
    this.dag = dag;

    this.render();
    this.attachEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="flex flex-wrap items-center gap-1 px-3 py-1.5 bg-gray-50/80 border-b border-gray-200 text-xs text-gray-700 select-none">
        <!-- History: Undo / Redo / Print -->
        <button id="tb-undo" title="Undo (Ctrl+Z)" class="p-1.5 hover:bg-gray-200 rounded transition text-gray-600 disabled:opacity-40">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l6 6m-6-6l6-6"></path></svg>
        </button>
        <button id="tb-redo" title="Redo (Ctrl+Y)" class="p-1.5 hover:bg-gray-200 rounded transition text-gray-600 disabled:opacity-40">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10H11a5 5 0 00-5 5v2m15-7l-6 6m6-6l-6-6"></path></svg>
        </button>
        <button id="tb-print" title="Print spreadsheet (Ctrl+P)" class="p-1.5 hover:bg-gray-200 rounded transition text-gray-600">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
        </button>

        <div class="h-4 w-px bg-gray-300 mx-1"></div>

        <!-- Number Formats -->
        <button id="tb-format-currency" title="Format as currency ($)" class="px-2 py-1 hover:bg-gray-200 rounded font-semibold text-gray-700 transition">
          $
        </button>
        <button id="tb-format-percent" title="Format as percent (%)" class="px-2 py-1 hover:bg-gray-200 rounded font-semibold text-gray-700 transition">
          %
        </button>
        <button id="tb-decimals-decrease" title="Decrease decimal places" class="px-1.5 py-1 hover:bg-gray-200 rounded font-mono text-[11px] text-gray-700 transition">
          .0
        </button>
        <button id="tb-decimals-increase" title="Increase decimal places" class="px-1.5 py-1 hover:bg-gray-200 rounded font-mono text-[11px] text-gray-700 transition">
          .00
        </button>

        <div class="h-4 w-px bg-gray-300 mx-1"></div>

        <!-- Styling: Bold, Italic, Strikethrough -->
        <button id="tb-bold" title="Bold (Ctrl+B)" class="px-2 py-1 hover:bg-gray-200 rounded font-bold transition">
          B
        </button>
        <button id="tb-italic" title="Italic (Ctrl+I)" class="px-2 py-1 hover:bg-gray-200 rounded italic font-serif transition">
          I
        </button>
        <button id="tb-strikethrough" title="Strikethrough" class="px-2 py-1 hover:bg-gray-200 rounded line-through transition">
          S
        </button>

        <!-- Color pickers -->
        <div class="relative flex items-center gap-1">
          <label title="Text color" class="p-1 hover:bg-gray-200 rounded cursor-pointer flex items-center">
            <span class="font-bold underline decoration-red-500 decoration-2">A</span>
            <input id="tb-text-color" type="color" value="#000000" class="sr-only" />
          </label>
          <label title="Fill color" class="p-1 hover:bg-gray-200 rounded cursor-pointer flex items-center">
            <svg class="w-3.5 h-3.5 text-gray-700" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.732V5a2 2 0 012-2h4a2 2 0 012 2v6.268A2 2 0 0118 13v1a3 3 0 11-6 0v-1a2 2 0 01-1-1.732z" clip-rule="evenodd"></path></svg>
            <input id="tb-fill-color" type="color" value="#ffffff" class="sr-only" />
          </label>
        </div>

        <div class="h-4 w-px bg-gray-300 mx-1"></div>

        <!-- Alignment -->
        <button id="tb-align-left" title="Align left" class="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h14"></path></svg>
        </button>
        <button id="tb-align-center" title="Align center" class="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M7 12h10M5 18h14"></path></svg>
        </button>
        <button id="tb-align-right" title="Align right" class="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M10 12h10M6 18h14"></path></svg>
        </button>

        <div class="h-4 w-px bg-gray-300 mx-1"></div>

        <!-- Quick Function Dropdown -->
        <div class="relative group">
          <button title="Functions (SUM, AVERAGE, etc.)" class="px-2 py-1 hover:bg-gray-200 rounded flex items-center gap-1 font-semibold text-gray-700">
            <span class="font-serif">∑</span>
            <span class="text-[9px]">▼</span>
          </button>
          <div class="absolute left-0 top-full mt-1 hidden group-hover:block bg-white border border-gray-200 rounded shadow-lg py-1 z-30 w-36">
            <button class="w-full text-left px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-700 text-xs flex justify-between" data-insert-fn="SUM"><span>SUM</span><span class="text-gray-400 font-mono text-[10px]">∑</span></button>
            <button class="w-full text-left px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-700 text-xs flex justify-between" data-insert-fn="AVERAGE"><span>AVERAGE</span><span class="text-gray-400 font-mono text-[10px]">avg</span></button>
            <button class="w-full text-left px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-700 text-xs flex justify-between" data-insert-fn="COUNT"><span>COUNT</span><span class="text-gray-400 font-mono text-[10px]">cnt</span></button>
            <button class="w-full text-left px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-700 text-xs flex justify-between" data-insert-fn="MAX"><span>MAX</span><span class="text-gray-400 font-mono text-[10px]">max</span></button>
            <button class="w-full text-left px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-700 text-xs flex justify-between" data-insert-fn="MIN"><span>MIN</span><span class="text-gray-400 font-mono text-[10px]">min</span></button>
          </div>
        </div>

        <div class="flex-1"></div>

        <!-- WebMCP AI Agent Button -->
        <button
          id="btn-toggle-agent"
          class="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-full shadow-xs transition"
          title="Open WebMCP AI Agent Console"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-200 animate-pulse"></span>
          <span>WebMCP Agent</span>
        </button>
      </div>
    `;
  }

  private attachEvents(): void {
    // History
    document.getElementById('tb-undo')?.addEventListener('click', () => this.store.undo());
    document.getElementById('tb-redo')?.addEventListener('click', () => this.store.redo());
    document.getElementById('tb-print')?.addEventListener('click', () => window.print());

    // Formatting
    document.getElementById('tb-bold')?.addEventListener('click', () => this.toggleFormat('bold'));
    document.getElementById('tb-italic')?.addEventListener('click', () => this.toggleFormat('italic'));
    document.getElementById('tb-strikethrough')?.addEventListener('click', () => this.toggleFormat('strikethrough'));

    // Colors
    document.getElementById('tb-text-color')?.addEventListener('change', (e) => {
      const color = (e.target as HTMLInputElement).value;
      this.applyFormat({ textColor: color });
    });

    document.getElementById('tb-fill-color')?.addEventListener('change', (e) => {
      const color = (e.target as HTMLInputElement).value;
      this.applyFormat({ bgColor: color });
    });

    // Alignment
    document.getElementById('tb-align-left')?.addEventListener('click', () => this.applyFormat({ align: 'left' }));
    document.getElementById('tb-align-center')?.addEventListener('click', () => this.applyFormat({ align: 'center' }));
    document.getElementById('tb-align-right')?.addEventListener('click', () => this.applyFormat({ align: 'right' }));

    // Numbers
    document.getElementById('tb-format-currency')?.addEventListener('click', () => {
      this.applyFormat({ numberFormat: 'currency', decimals: 2 });
    });
    document.getElementById('tb-format-percent')?.addEventListener('click', () => {
      this.applyFormat({ numberFormat: 'percent', decimals: 2 });
    });
    document.getElementById('tb-decimals-decrease')?.addEventListener('click', () => {
      const activeCoord = this.grid.getActiveCoord();
      const ref = coordsToRef(activeCoord.col, activeCoord.row);
      const cell = this.store.getCell(ref);
      const dec = Math.max(0, (cell?.format?.decimals ?? 2) - 1);
      this.applyFormat({ decimals: dec, numberFormat: cell?.format?.numberFormat || 'number' });
    });
    document.getElementById('tb-decimals-increase')?.addEventListener('click', () => {
      const activeCoord = this.grid.getActiveCoord();
      const ref = coordsToRef(activeCoord.col, activeCoord.row);
      const cell = this.store.getCell(ref);
      const dec = (cell?.format?.decimals ?? 2) + 1;
      this.applyFormat({ decimals: dec, numberFormat: cell?.format?.numberFormat || 'number' });
    });

    // Function shortcuts
    document.querySelectorAll('[data-insert-fn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fnName = btn.getAttribute('data-insert-fn');
        const activeCoord = this.grid.getActiveCoord();
        const ref = coordsToRef(activeCoord.col, activeCoord.row);
        const formula = `=${fnName}(A1:A5)`;
        this.store.setCellRaw(ref, formula);
        this.dag.updateCellDependencies(ref, formula);
        this.dag.recalculate(ref);
        this.grid.render();
      });
    });
  }

  private toggleFormat(prop: 'bold' | 'italic' | 'strikethrough'): void {
    const range = this.grid.getSelectionRange();
    const activeCoord = this.grid.getActiveCoord();
    const activeRef = coordsToRef(activeCoord.col, activeCoord.row);
    const activeCell = this.store.getCell(activeRef);
    const current = activeCell?.format?.[prop] || false;

    this.store.setRangeFormat(range, { [prop]: !current });
    this.grid.render();
  }

  private applyFormat(fmt: any): void {
    const range = this.grid.getSelectionRange();
    this.store.setRangeFormat(range, fmt);
    this.grid.render();
  }
}
