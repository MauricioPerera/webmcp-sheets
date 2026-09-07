import { CellStore, coordsToRef, colIndexToName, parseCellRef } from '../core/cell-store';
import { DependencyGraph } from '../core/dependency-graph';
import { ImporterExporter } from '../core/importer-exporter';
import { CellCoord, CellRange } from '../core/types';

export class SpreadsheetGrid {
  private container: HTMLElement;
  private store: CellStore;
  private dag: DependencyGraph;
  private io: ImporterExporter;

  private activeCell: CellCoord = { col: 0, row: 0 };
  private selectionRange: CellRange = { startCol: 0, startRow: 0, endCol: 0, endRow: 0 };
  private isSelecting = false;
  private isDraggingFill = false;
  private isEditing = false;

  private defaultColWidth = 100;
  private defaultRowHeight = 24;
  private headerColWidth = 46;
  private headerRowHeight = 26;

  private colWidths: Record<number, number> = {};
  private rowHeights: Record<number, number> = {};

  private editorInput: HTMLInputElement | null = null;
  private onSelectionChangeCallback?: (coord: CellCoord, range: CellRange) => void;
  private onCellEditCallback?: (val: string) => void;

  constructor(
    containerId: string,
    store: CellStore,
    dag: DependencyGraph,
    io: ImporterExporter
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.store = store;
    this.dag = dag;
    this.io = io;

    this.render();
    this.attachEvents();
    this.store.subscribe((evt) => {
      if (['cell_change', 'format_change', 'sheet_change', 'loaded', 'undo', 'redo'].includes(evt)) {
        this.render();
      }
    });
  }

  public onSelectionChange(fn: (coord: CellCoord, range: CellRange) => void): void {
    this.onSelectionChangeCallback = fn;
  }

  public onCellEdit(fn: (val: string) => void): void {
    this.onCellEditCallback = fn;
  }

  public getActiveCoord(): CellCoord {
    return { ...this.activeCell };
  }

  public getSelectionRange(): CellRange {
    return { ...this.selectionRange };
  }

  public setActiveCell(col: number, row: number, expandSelection = false): void {
    const sheet = this.store.getActiveSheet();
    const clampedCol = Math.max(0, Math.min(col, sheet.colCount - 1));
    const clampedRow = Math.max(0, Math.min(row, sheet.rowCount - 1));

    if (expandSelection) {
      this.selectionRange.endCol = clampedCol;
      this.selectionRange.endRow = clampedRow;
    } else {
      this.activeCell = { col: clampedCol, row: clampedRow };
      this.selectionRange = {
        startCol: clampedCol,
        startRow: clampedRow,
        endCol: clampedCol,
        endRow: clampedRow,
      };
    }

    this.updateSelectionBox();
    if (this.onSelectionChangeCallback) {
      this.onSelectionChangeCallback(this.activeCell, this.getNormalizedRange());
    }
  }

  public startEditing(initialChar?: string): void {
    if (this.isEditing) return;
    this.isEditing = true;

    const ref = coordsToRef(this.activeCell.col, this.activeCell.row);
    const cell = this.store.getCell(ref);
    const initialVal = initialChar !== undefined ? initialChar : cell?.raw || '';

    const cellEl = this.getCellElement(this.activeCell.col, this.activeCell.row);
    if (!cellEl) return;

    const input = document.createElement('input');
    this.editorInput = input;
    input.type = 'text';
    input.value = initialVal;
    input.className =
      'absolute z-20 px-1 py-0.5 font-sans text-xs bg-white border-2 border-emerald-600 outline-none shadow-md';

    const rect = cellEl.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const scrollLeft = this.container.scrollLeft;
    const scrollTop = this.container.scrollTop;

    input.style.left = `${rect.left - containerRect.left + scrollLeft}px`;
    input.style.top = `${rect.top - containerRect.top + scrollTop}px`;
    input.style.width = `${Math.max(rect.width, 120)}px`;
    input.style.height = `${rect.height}px`;

    input.addEventListener('input', () => {
      if (this.onCellEditCallback) {
        this.onCellEditCallback(input.value);
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.commitEdit();
        this.setActiveCell(this.activeCell.col, this.activeCell.row + 1);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.commitEdit();
        this.setActiveCell(this.activeCell.col + 1, this.activeCell.row);
      } else if (e.key === 'Escape') {
        this.cancelEdit();
      }
    });

    input.addEventListener('blur', () => {
      if (this.isEditing) {
        this.commitEdit();
      }
    });

    this.container.appendChild(input);
    input.focus();
    if (initialChar === undefined) {
      input.select();
    }
  }

  public commitEdit(): void {
    if (!this.isEditing || !this.editorInput) return;
    const val = this.editorInput.value;
    const ref = coordsToRef(this.activeCell.col, this.activeCell.row);

    this.store.setCellRaw(ref, val);
    const { hasCycle } = this.dag.updateCellDependencies(ref, val);
    if (!hasCycle) {
      this.dag.recalculate(ref);
    }

    this.cleanupEditor();
  }

  public cancelEdit(): void {
    this.cleanupEditor();
  }

  private cleanupEditor(): void {
    if (this.editorInput && this.editorInput.parentNode) {
      this.editorInput.parentNode.removeChild(this.editorInput);
    }
    this.editorInput = null;
    this.isEditing = false;
  }

  public updateActiveCellValue(val: string): void {
    if (this.isEditing && this.editorInput) {
      this.editorInput.value = val;
    }
    const ref = coordsToRef(this.activeCell.col, this.activeCell.row);
    this.store.setCellRaw(ref, val);
    const { hasCycle } = this.dag.updateCellDependencies(ref, val);
    if (!hasCycle) {
      this.dag.recalculate(ref);
    }
  }

  public render(): void {
    const sheet = this.store.getActiveSheet();
    const rows = sheet.rowCount;
    const cols = sheet.colCount;

    let html = `
      <div id="grid-inner" class="relative select-none inline-block min-w-full">
        <!-- Selection Highlights & Fill Handle Box -->
        <div id="selection-box" class="absolute pointer-events-none border-2 border-emerald-600 bg-emerald-500/10 z-10 hidden">
          <div id="fill-handle" class="absolute -right-1 -bottom-1 w-2 h-2 bg-emerald-600 cursor-crosshair pointer-events-auto border border-white"></div>
        </div>

        <table class="border-collapse bg-white font-sans text-xs">
          <thead>
            <tr class="bg-gray-100 text-gray-600 font-normal sticky top-0 z-10 border-b border-gray-300">
              <th class="w-11 min-w-[46px] h-6 bg-gray-200 border-r border-gray-300 sticky left-0 z-20 text-center font-normal text-[10px] text-gray-500"></th>
    `;

    // Column Headers
    for (let c = 0; c < cols; c++) {
      const colLetter = colIndexToName(c);
      const width = this.colWidths[c] || this.defaultColWidth;
      html += `
        <th data-col="${c}" style="width:${width}px; min-width:${width}px;" class="col-header relative h-6 border-r border-gray-300 text-center font-normal text-[11px] select-none hover:bg-gray-200">
          ${colLetter}
          <div class="col-resizer absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-500"></div>
        </th>
      `;
    }

    html += `
            </tr>
          </thead>
          <tbody>
    `;

    // Grid Rows
    for (let r = 0; r < rows; r++) {
      const rowNum = r + 1;
      const height = this.rowHeights[r] || this.defaultRowHeight;
      html += `
        <tr style="height:${height}px;">
          <th data-row="${r}" class="row-header sticky left-0 z-10 bg-gray-100 border-b border-r border-gray-300 text-center font-normal text-[11px] text-gray-600 select-none hover:bg-gray-200">
            ${rowNum}
            <div class="row-resizer absolute left-0 right-0 bottom-0 h-1 cursor-row-resize hover:bg-emerald-500"></div>
          </th>
      `;

      for (let c = 0; c < cols; c++) {
        const ref = coordsToRef(c, r);
        const cell = sheet.cells[ref];
        const displayVal = cell?.error
          ? `<span class="text-red-600 font-mono font-bold">${cell.error}</span>`
          : cell?.computed !== undefined && cell?.computed !== null
          ? this.formatDisplayValue(cell.computed, cell.format)
          : cell?.raw
          ? this.formatDisplayValue(cell.raw, cell.format)
          : '';

        const style = this.buildCellStyle(cell?.format);
        html += `
          <td data-col="${c}" data-row="${r}" style="${style}" class="cell border-b border-r border-gray-200 px-1.5 overflow-hidden whitespace-nowrap text-ellipsis cursor-cell">
            ${displayVal}
          </td>
        `;
      }

      html += `</tr>`;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    this.container.innerHTML = html;
    this.updateSelectionBox();
  }

  private formatDisplayValue(val: any, format?: any): string {
    if (val === null || val === undefined) return '';

    if (format?.numberFormat === 'currency' && !isNaN(Number(val))) {
      return `$${Number(val).toLocaleString(undefined, {
        minimumFractionDigits: format.decimals ?? 2,
        maximumFractionDigits: format.decimals ?? 2,
      })}`;
    }

    if (format?.numberFormat === 'percent' && !isNaN(Number(val))) {
      return `${(Number(val) * 100).toFixed(format.decimals ?? 2)}%`;
    }

    if (format?.numberFormat === 'number' && !isNaN(Number(val))) {
      return Number(val).toLocaleString(undefined, {
        minimumFractionDigits: format.decimals ?? 0,
        maximumFractionDigits: format.decimals ?? 2,
      });
    }

    return String(val);
  }

  private buildCellStyle(format?: any): string {
    if (!format) return '';
    const parts: string[] = [];
    if (format.bold) parts.push('font-weight:bold');
    if (format.italic) parts.push('font-style:italic');
    if (format.underline) parts.push('text-decoration:underline');
    if (format.strikethrough) parts.push('text-decoration:line-through');
    if (format.textColor) parts.push(`color:${format.textColor}`);
    if (format.bgColor) parts.push(`background-color:${format.bgColor}`);
    if (format.align) parts.push(`text-align:${format.align}`);
    return parts.join(';');
  }

  private attachEvents(): void {
    // Mouse interaction on cells
    this.container.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;

      // Fill handle drag
      if (target && target.id === 'fill-handle') {
        e.preventDefault();
        this.isDraggingFill = true;
        return;
      }

      // Cell selection
      const cell = target && typeof target.closest === 'function' ? (target.closest('td.cell') as HTMLElement) : null;
      if (cell) {
        const col = parseInt(cell.dataset.col || '0', 10);
        const row = parseInt(cell.dataset.row || '0', 10);

        if (this.isEditing) {
          this.commitEdit();
        }

        if (e.shiftKey) {
          this.setActiveCell(col, row, true);
        } else {
          this.isSelecting = true;
          this.setActiveCell(col, row, false);
        }
      }
    });

    this.container.addEventListener('mousemove', (e) => {
      if (!this.isSelecting && !this.isDraggingFill) return;
      const target = e.target as HTMLElement;
      const cell = target && typeof target.closest === 'function' ? (target.closest('td.cell') as HTMLElement) : null;
      if (cell) {
        const col = parseInt(cell.dataset.col || '0', 10);
        const row = parseInt(cell.dataset.row || '0', 10);
        this.setActiveCell(col, row, true);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDraggingFill) {
        this.performAutoFill();
        this.isDraggingFill = false;
      }
      this.isSelecting = false;
    });

    // Double click to edit cell
    this.container.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      const cell = target && typeof target.closest === 'function' ? (target.closest('td.cell') as HTMLElement) : null;
      if (cell) {
        this.startEditing();
      }
    });

    // Keyboard navigation & shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.isEditing) return;

      // Ignore when focused inside modal inputs
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.setActiveCell(this.activeCell.col, this.activeCell.row - 1, e.shiftKey);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.setActiveCell(this.activeCell.col, this.activeCell.row + 1, e.shiftKey);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.setActiveCell(this.activeCell.col - 1, this.activeCell.row, e.shiftKey);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.setActiveCell(this.activeCell.col + 1, this.activeCell.row, e.shiftKey);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.setActiveCell(this.activeCell.col + (e.shiftKey ? -1 : 1), this.activeCell.row);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this.setActiveCell(this.activeCell.col, this.activeCell.row - 1);
        } else {
          this.startEditing();
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        this.startEditing();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.clearSelectedCells();
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          this.store.undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          this.store.redo();
        } else if (e.key === 'c') {
          e.preventDefault();
          this.copyToClipboard();
        } else if (e.key === 'v') {
          // Paste event caught below
        } else if (e.key === 'b') {
          e.preventDefault();
          this.toggleFormat('bold');
        } else if (e.key === 'i') {
          e.preventDefault();
          this.toggleFormat('italic');
        } else if (e.key === 'u') {
          e.preventDefault();
          this.toggleFormat('underline');
        }
      } else if (e.key && e.key.length === 1 && !e.altKey) {
        // Start typing directly into active cell
        this.startEditing(e.key);
      }
    });

    // Paste handler
    window.addEventListener('paste', (e) => {
      if (this.isEditing) return;
      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        e.preventDefault();
        this.io.pasteTSV(text, this.activeCell.col, this.activeCell.row);
        this.dag.recalculateAll();
        this.render();
      }
    });
  }

  private performAutoFill(): void {
    const range = this.getNormalizedRange();
    const sourceRef = coordsToRef(this.activeCell.col, this.activeCell.row);
    const sourceCell = this.store.getCell(sourceRef);
    if (!sourceCell) return;

    this.store.recordHistory('Auto-fill');
    const sheet = this.store.getActiveSheet();

    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        if (c === this.activeCell.col && r === this.activeCell.row) continue;

        const targetRef = coordsToRef(c, r);
        let newVal = sourceCell.raw;

        // Smart reference shift for formulas
        if (sourceCell.raw.startsWith('=')) {
          const rowDiff = r - this.activeCell.row;
          const colDiff = c - this.activeCell.col;
          newVal = this.shiftFormulaReferences(sourceCell.raw, colDiff, rowDiff);
        } else if (!isNaN(Number(sourceCell.raw)) && sourceCell.raw.trim() !== '') {
          // Series continuation
          const rowDiff = r - this.activeCell.row;
          newVal = String(Number(sourceCell.raw) + rowDiff);
        }

        this.store.setCell(
          targetRef,
          { raw: newVal, format: sourceCell.format },
          sheet.id,
          false
        );
        this.dag.updateCellDependencies(targetRef, newVal, sheet.id);
      }
    }

    this.dag.recalculateAll();
    this.render();
  }

  private shiftFormulaReferences(formula: string, colDiff: number, rowDiff: number): string {
    return formula.replace(/(\$?[A-Za-z]+)(\$?[0-9]+)/g, (match, colPart, rowPart) => {
      let shiftedCol = colPart;
      let shiftedRow = rowPart;

      if (!colPart.startsWith('$')) {
        const c = parseCellRef(colPart + '1').col + colDiff;
        shiftedCol = colIndexToName(Math.max(0, c));
      }

      if (!rowPart.startsWith('$')) {
        const r = parseInt(rowPart, 10) + rowDiff;
        shiftedRow = String(Math.max(1, r));
      }

      return `${shiftedCol}${shiftedRow}`;
    });
  }

  private copyToClipboard(): void {
    const range = this.getNormalizedRange();
    const tsv = this.io.exportTSV(range.startCol, range.startRow, range.endCol, range.endRow);
    navigator.clipboard.writeText(tsv);
  }

  private clearSelectedCells(): void {
    const range = this.getNormalizedRange();
    this.store.clearRange(range);
    this.dag.recalculateAll();
    this.render();
  }

  private toggleFormat(prop: 'bold' | 'italic' | 'underline'): void {
    const ref = coordsToRef(this.activeCell.col, this.activeCell.row);
    const cell = this.store.getCell(ref);
    const current = cell?.format?.[prop] || false;
    this.store.setCellFormat(ref, { [prop]: !current });
    this.render();
  }

  private updateSelectionBox(): void {
    const box = document.getElementById('selection-box');
    if (!box) return;

    const range = this.getNormalizedRange();
    const startCell = this.getCellElement(range.startCol, range.startRow);
    const endCell = this.getCellElement(range.endCol, range.endRow);

    if (!startCell || !endCell) {
      box.classList.add('hidden');
      return;
    }

    box.classList.remove('hidden');
    const startRect = startCell.getBoundingClientRect();
    const endRect = endCell.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const scrollLeft = this.container.scrollLeft;
    const scrollTop = this.container.scrollTop;

    box.style.left = `${startRect.left - containerRect.left + scrollLeft}px`;
    box.style.top = `${startRect.top - containerRect.top + scrollTop}px`;
    box.style.width = `${endRect.right - startRect.left}px`;
    box.style.height = `${endRect.bottom - startRect.top}px`;
  }

  private getCellElement(col: number, row: number): HTMLElement | null {
    return this.container.querySelector(`td[data-col="${col}"][data-row="${row}"]`);
  }

  private getNormalizedRange(): CellRange {
    return {
      startCol: Math.min(this.selectionRange.startCol, this.selectionRange.endCol),
      startRow: Math.min(this.selectionRange.startRow, this.selectionRange.endRow),
      endCol: Math.max(this.selectionRange.startCol, this.selectionRange.endCol),
      endRow: Math.max(this.selectionRange.startRow, this.selectionRange.endRow),
    };
  }
}
