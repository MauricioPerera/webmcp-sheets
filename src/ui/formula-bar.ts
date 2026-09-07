import { CellStore, coordsToRef } from '../core/cell-store';
import { DependencyGraph } from '../core/dependency-graph';
import { SpreadsheetGrid } from './grid';
import { CellCoord } from '../core/types';

export class FormulaBar {
  private container: HTMLElement;
  private store: CellStore;
  private dag: DependencyGraph;
  private grid: SpreadsheetGrid;

  private nameBox!: HTMLElement;
  private input!: HTMLInputElement;
  private activeCoord: CellCoord = { col: 0, row: 0 };

  constructor(
    containerId: string,
    store: CellStore,
    dag: DependencyGraph,
    grid: SpreadsheetGrid
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.store = store;
    this.dag = dag;
    this.grid = grid;

    this.render();
    this.attachEvents();
  }

  public updateActiveCell(coord: CellCoord): void {
    this.activeCoord = coord;
    const ref = coordsToRef(coord.col, coord.row);
    this.nameBox.textContent = ref;

    const cell = this.store.getCell(ref);
    this.input.value = cell?.raw || '';
  }

  public setInputValue(val: string): void {
    this.input.value = val;
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="flex items-center gap-1.5 px-3 py-1 bg-white border-b border-gray-200 text-xs">
        <!-- Coordinate Box -->
        <div id="formula-name-box" class="w-14 px-2 py-1 text-center font-mono font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded shadow-xs select-none">
          A1
        </div>

        <!-- Buttons: Cancel, Accept, fx -->
        <div class="flex items-center text-gray-400 gap-0.5">
          <button id="btn-formula-cancel" title="Cancel edit" class="p-1 hover:text-red-500 hover:bg-gray-100 rounded transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          <button id="btn-formula-accept" title="Accept" class="p-1 hover:text-emerald-600 hover:bg-gray-100 rounded transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          </button>
          <div class="h-4 w-px bg-gray-200 mx-1"></div>
          <button id="btn-formula-fx" hx-get="/modal/functions" hx-target="#modal-container" hx-swap="innerHTML" title="Insert function" class="p-1 hover:text-gray-700 hover:bg-gray-100 rounded transition flex items-center font-serif italic font-bold text-gray-500">
            fx
          </button>
        </div>

        <!-- Formula Text Input -->
        <div class="flex-1 relative">
          <input
            id="formula-input"
            type="text"
            placeholder="Type a value or =formula (e.g. =SUM(A1:A10))"
            class="w-full px-2 py-1 font-mono text-xs text-gray-800 border border-gray-200 rounded focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
          />
        </div>
      </div>
    `;

    this.nameBox = document.getElementById('formula-name-box')!;
    this.input = document.getElementById('formula-input') as HTMLInputElement;
  }

  private attachEvents(): void {
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.commit();
        this.grid.setActiveCell(this.activeCoord.col, this.activeCoord.row + 1);
      } else if (e.key === 'Escape') {
        this.cancel();
      }
    });

    this.input.addEventListener('input', () => {
      const ref = coordsToRef(this.activeCoord.col, this.activeCoord.row);
      this.grid.updateActiveCellValue(this.input.value);
    });

    document.getElementById('btn-formula-accept')?.addEventListener('click', () => {
      this.commit();
    });

    document.getElementById('btn-formula-cancel')?.addEventListener('click', () => {
      this.cancel();
    });
  }

  private commit(): void {
    const val = this.input.value;
    const ref = coordsToRef(this.activeCoord.col, this.activeCoord.row);
    this.store.setCellRaw(ref, val);
    this.dag.updateCellDependencies(ref, val);
    this.dag.recalculate(ref);
    this.grid.render();
  }

  private cancel(): void {
    const ref = coordsToRef(this.activeCoord.col, this.activeCoord.row);
    const cell = this.store.getCell(ref);
    this.input.value = cell?.raw || '';
  }
}
