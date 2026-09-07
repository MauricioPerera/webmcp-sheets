import { CellStore } from '../core/cell-store';
import { ImporterExporter } from '../core/importer-exporter';
import { SpreadsheetGrid } from './grid';
import { DependencyGraph } from '../core/dependency-graph';

export class MenuBar {
  private container: HTMLElement;
  private store: CellStore;
  private io: ImporterExporter;
  private grid: SpreadsheetGrid;
  private dag: DependencyGraph;

  constructor(
    containerId: string,
    store: CellStore,
    io: ImporterExporter,
    grid: SpreadsheetGrid,
    dag: DependencyGraph
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.store = store;
    this.io = io;
    this.grid = grid;
    this.dag = dag;

    this.render();
    this.attachEvents();
  }

  private render(): void {
    const title = this.store.getTitle();

    this.container.innerHTML = `
      <div class="flex items-center justify-between px-3 py-1.5 bg-white border-b border-gray-200 text-xs">
        <div class="flex items-center gap-3">
          <!-- Sheets Logo -->
          <div class="flex items-center gap-1.5 cursor-pointer" title="WebMCP Sheets">
            <svg class="w-8 h-8 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h4v2H7zm0 4h4v2H7zm0 4h4v2H7zm6-8h4v2h-4zm0 4h4v2h-4zm0 4h4v2h-4z"/>
            </svg>
          </div>

          <div class="flex flex-col">
            <!-- Document Title -->
            <input
              id="doc-title-input"
              type="text"
              value="${title}"
              class="font-medium text-sm text-gray-800 hover:bg-gray-100 px-1 py-0.5 rounded border border-transparent hover:border-gray-300 focus:border-emerald-600 focus:bg-white focus:outline-none w-56"
            />

            <!-- Menus Ribbon -->
            <div class="flex items-center gap-1 text-gray-600 text-xs mt-0.5">
              <!-- File Menu -->
              <div class="relative group">
                <button class="px-2 py-0.5 hover:bg-gray-100 rounded">File</button>
                <div class="absolute left-0 top-full hidden group-hover:block bg-white border border-gray-200 rounded shadow-lg py-1 z-40 w-44">
                  <button id="menu-new" class="w-full text-left px-3 py-1 hover:bg-gray-100">New spreadsheet</button>
                  <button hx-get="/modal/import" hx-target="#modal-container" hx-swap="innerHTML" class="w-full text-left px-3 py-1 hover:bg-gray-100">Import CSV / file...</button>
                  <button hx-get="/modal/export" hx-target="#modal-container" hx-swap="innerHTML" class="w-full text-left px-3 py-1 hover:bg-gray-100">Export / Download...</button>
                  <div class="border-t border-gray-100 my-1"></div>
                  <button onclick="window.print()" class="w-full text-left px-3 py-1 hover:bg-gray-100 flex justify-between"><span>Print</span><span class="text-gray-400 font-mono text-[10px]">Ctrl+P</span></button>
                </div>
              </div>

              <!-- Edit Menu -->
              <div class="relative group">
                <button class="px-2 py-0.5 hover:bg-gray-100 rounded">Edit</button>
                <div class="absolute left-0 top-full hidden group-hover:block bg-white border border-gray-200 rounded shadow-lg py-1 z-40 w-44">
                  <button id="menu-undo" class="w-full text-left px-3 py-1 hover:bg-gray-100 flex justify-between"><span>Undo</span><span class="text-gray-400 font-mono text-[10px]">Ctrl+Z</span></button>
                  <button id="menu-redo" class="w-full text-left px-3 py-1 hover:bg-gray-100 flex justify-between"><span>Redo</span><span class="text-gray-400 font-mono text-[10px]">Ctrl+Y</span></button>
                  <div class="border-t border-gray-100 my-1"></div>
                  <button hx-get="/modal/find-replace" hx-target="#modal-container" hx-swap="innerHTML" class="w-full text-left px-3 py-1 hover:bg-gray-100 flex justify-between"><span>Find and replace...</span><span class="text-gray-400 font-mono text-[10px]">Ctrl+H</span></button>
                </div>
              </div>

              <!-- View Menu -->
              <div class="relative group">
                <button class="px-2 py-0.5 hover:bg-gray-100 rounded">View</button>
                <div class="absolute left-0 top-full hidden group-hover:block bg-white border border-gray-200 rounded shadow-lg py-1 z-40 w-44">
                  <button id="menu-view-recalc" class="w-full text-left px-3 py-1 hover:bg-gray-100">Recalculate formulas</button>
                </div>
              </div>

              <!-- Insert Menu -->
              <div class="relative group">
                <button class="px-2 py-0.5 hover:bg-gray-100 rounded">Insert</button>
                <div class="absolute left-0 top-full hidden group-hover:block bg-white border border-gray-200 rounded shadow-lg py-1 z-40 w-44">
                  <button hx-get="/modal/functions" hx-target="#modal-container" hx-swap="innerHTML" class="w-full text-left px-3 py-1 hover:bg-gray-100">Function (fx)...</button>
                  <button id="menu-add-sheet" class="w-full text-left px-3 py-1 hover:bg-gray-100">New sheet</button>
                </div>
              </div>

              <!-- Tools Menu -->
              <div class="relative group">
                <button class="px-2 py-0.5 hover:bg-gray-100 rounded">Tools</button>
                <div class="absolute left-0 top-full hidden group-hover:block bg-white border border-gray-200 rounded shadow-lg py-1 z-40 w-48">
                  <button hx-get="/panel/webmcp-info" hx-target="#modal-container" hx-swap="innerHTML" class="w-full text-left px-3 py-1 hover:bg-gray-100 flex items-center justify-between">
                    <span>WebMCP tools info</span>
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </button>
                </div>
              </div>

              <!-- Help Menu -->
              <div class="relative group">
                <button class="px-2 py-0.5 hover:bg-gray-100 rounded">Help</button>
                <div class="absolute left-0 top-full hidden group-hover:block bg-white border border-gray-200 rounded shadow-lg py-1 z-40 w-48">
                  <button hx-get="/modal/functions" hx-target="#modal-container" hx-swap="innerHTML" class="w-full text-left px-3 py-1 hover:bg-gray-100">Supported functions</button>
                  <button hx-get="/modal/shortcuts" hx-target="#modal-container" hx-swap="innerHTML" class="w-full text-left px-3 py-1 hover:bg-gray-100">Keyboard shortcuts</button>
                  <a href="https://webmcp.com" target="_blank" rel="noopener" class="block w-full text-left px-3 py-1 hover:bg-gray-100 text-emerald-700">webmcp.com Directory &#8599;</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-[11px] text-gray-500 flex items-center gap-1">
            <svg class="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
            Saved locally
          </span>
        </div>
      </div>
    `;
  }

  private attachEvents(): void {
    const titleInput = document.getElementById('doc-title-input') as HTMLInputElement;
    titleInput?.addEventListener('change', () => {
      this.store.setTitle(titleInput.value);
    });

    document.getElementById('menu-new')?.addEventListener('click', () => {
      if (confirm('Create new spreadsheet? Unsaved changes will be cleared.')) {
        localStorage.removeItem('webmcp_sheets_workbook_v1');
        window.location.reload();
      }
    });

    document.getElementById('menu-undo')?.addEventListener('click', () => this.store.undo());
    document.getElementById('menu-redo')?.addEventListener('click', () => this.store.redo());
    document.getElementById('menu-add-sheet')?.addEventListener('click', () => this.store.addSheet());
    document.getElementById('menu-view-recalc')?.addEventListener('click', () => {
      this.dag.recalculateAll();
      this.grid.render();
    });
  }
}
