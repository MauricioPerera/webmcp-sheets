import { CellStore, coordsToRef } from '../core/cell-store';
import { CellRange } from '../core/types';

export class SheetTabs {
  private container: HTMLElement;
  private store: CellStore;

  private statsSummary: { count: number; sum: number; avg: number; min: number; max: number } = {
    count: 0,
    sum: 0,
    avg: 0,
    min: 0,
    max: 0,
  };

  constructor(containerId: string, store: CellStore) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.store = store;

    this.render();
    this.attachEvents();
    this.store.subscribe((evt) => {
      if (['sheet_added', 'sheet_deleted', 'sheet_renamed', 'sheet_change', 'loaded'].includes(evt)) {
        this.render();
        this.attachEvents();
      }
    });
  }

  public updateSelectionStats(range: CellRange): void {
    const sheet = this.store.getActiveSheet();
    let count = 0;
    let sum = 0;
    let numCount = 0;
    let min = Infinity;
    let max = -Infinity;

    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const ref = coordsToRef(c, r);
        const cell = sheet.cells[ref];
        if (cell && (cell.raw !== '' || cell.computed !== undefined)) {
          count++;
          const val = cell.computed !== undefined ? cell.computed : cell.raw;
          if (typeof val === 'number') {
            sum += val;
            numCount++;
            if (val < min) min = val;
            if (val > max) max = val;
          } else if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') {
            const num = Number(val);
            sum += num;
            numCount++;
            if (num < min) min = num;
            if (num > max) max = num;
          }
        }
      }
    }

    this.statsSummary = {
      count,
      sum,
      avg: numCount > 0 ? sum / numCount : 0,
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 0 : max,
    };

    this.renderStats();
  }

  private render(): void {
    const sheets = this.store.getSheets();
    const activeSheet = this.store.getActiveSheet();

    const tabsHtml = sheets
      .map((s) => {
        const isActive = s.id === activeSheet.id;
        return `
        <div
          data-sheet-id="${s.id}"
          class="sheet-tab flex items-center gap-1.5 px-3 py-1 text-xs border-r border-gray-200 cursor-pointer select-none transition ${
            isActive
              ? 'bg-white font-medium text-emerald-800 border-b-2 border-b-emerald-600 shadow-xs'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200/70'
          }"
        >
          <span class="sheet-name">${s.name}</span>
          ${
            sheets.length > 1
              ? `<button data-delete-sheet="${s.id}" title="Delete sheet" class="text-gray-400 hover:text-red-500 rounded p-0.5 text-[10px]">✕</button>`
              : ''
          }
        </div>
      `;
      })
      .join('');

    this.container.innerHTML = `
      <div class="flex items-center justify-between bg-gray-50 border-t border-gray-200 h-9 px-2 text-xs">
        <!-- Add sheet + Tab List -->
        <div class="flex items-center h-full overflow-x-auto scrollbar-none">
          <button id="btn-add-sheet" title="Add sheet" class="p-1 text-gray-600 hover:text-emerald-700 hover:bg-gray-200 rounded mr-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          </button>
          <div class="flex items-center h-full">
            ${tabsHtml}
          </div>
        </div>

        <!-- Range Stats Indicator -->
        <div id="status-stats-container" class="flex items-center gap-3 text-gray-500 font-mono text-[11px] px-2 select-none">
        </div>
      </div>
    `;

    this.renderStats();
  }

  private renderStats(): void {
    const el = document.getElementById('status-stats-container');
    if (!el) return;

    if (this.statsSummary.count === 0) {
      el.innerHTML = `<span class="text-gray-400 font-sans text-xs">Ready</span>`;
      return;
    }

    let statsStr = `<span class="text-gray-700">Count: <b>${this.statsSummary.count}</b></span>`;
    if (this.statsSummary.sum !== 0 || this.statsSummary.avg !== 0) {
      statsStr += `
        <span class="h-3 w-px bg-gray-300"></span>
        <span class="text-gray-700">Sum: <b>${this.statsSummary.sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></span>
        <span class="h-3 w-px bg-gray-300"></span>
        <span class="text-gray-700">Avg: <b>${this.statsSummary.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></span>
        <span class="h-3 w-px bg-gray-300"></span>
        <span class="text-gray-700">Min: <b>${this.statsSummary.min}</b></span>
        <span class="h-3 w-px bg-gray-300"></span>
        <span class="text-gray-700">Max: <b>${this.statsSummary.max}</b></span>
      `;
    }

    el.innerHTML = statsStr;
  }

  private attachEvents(): void {
    document.getElementById('btn-add-sheet')?.addEventListener('click', () => {
      this.store.addSheet();
    });

    document.querySelectorAll('.sheet-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.dataset.deleteSheet) {
          const sheetId = target.dataset.deleteSheet;
          if (confirm('Delete this sheet?')) {
            this.store.deleteSheet(sheetId);
          }
          return;
        }

        const sheetId = (tab as HTMLElement).dataset.sheetId;
        if (sheetId) {
          this.store.setActiveSheet(sheetId);
        }
      });

      // Double click to rename
      tab.addEventListener('dblclick', () => {
        const sheetId = (tab as HTMLElement).dataset.sheetId;
        const nameSpan = tab.querySelector('.sheet-name') as HTMLElement;
        if (!sheetId || !nameSpan) return;

        const currentName = nameSpan.textContent || '';
        const newName = prompt('Rename sheet:', currentName);
        if (newName && newName.trim() !== '') {
          this.store.renameSheet(sheetId, newName.trim());
        }
      });
    });
  }
}
