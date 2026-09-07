import { CellStore } from '../core/cell-store';
import { WebMcpService } from '../core/webmcp-service';
import { ImporterExporter } from '../core/importer-exporter';

export class HtmxRouter {
  private store: CellStore;
  private webmcp: WebMcpService;
  private io: ImporterExporter;

  constructor(store: CellStore, webmcp: WebMcpService, io: ImporterExporter) {
    this.store = store;
    this.webmcp = webmcp;
    this.io = io;

    this.attachInterceptor();
  }

  public renderRoute(path: string): string {
    const url = path.split('?')[0];

    switch (url) {
      case '/modal/find-replace':
        return this.renderFindReplaceModal();
      case '/modal/functions':
        return this.renderFunctionsModal();
      case '/modal/export':
        return this.renderExportModal();
      case '/modal/import':
        return this.renderImportModal();
      case '/modal/shortcuts':
        return this.renderShortcutsModal();
      case '/panel/webmcp-info':
        return this.renderWebMcpInfo();
      default:
        return `<div class="p-4 text-red-500">Route ${url} not found</div>`;
    }
  }

  private attachInterceptor(): void {
    if (typeof document === 'undefined') return;

    document.body.addEventListener('htmx:beforeRequest', (evt: any) => {
      const path = evt.detail?.requestConfig?.path;
      if (path && path.startsWith('/')) {
        // Prevent actual network dispatch
        evt.preventDefault();
        const target = evt.detail?.target;
        if (target) {
          const html = this.renderRoute(path);
          target.innerHTML = html;
          // Re-process new HTMX elements inside target if htmx exists
          const htmx = (window as any).htmx;
          if (htmx) {
            htmx.process(target);
          }
        }
      }
    });
  }

  public renderFindReplaceModal(): string {
    return `
      <div id="modal-backdrop" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h3 class="font-medium text-gray-800 flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              Find and replace
            </h3>
            <button onclick="document.getElementById('modal-backdrop').remove()" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">✕</button>
          </div>
          <div class="p-5 space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Find</label>
              <input id="find-input" type="text" placeholder="Search text or formula" class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm" autofocus />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Replace with</label>
              <input id="replace-input" type="text" placeholder="New text" class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm" />
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-700">
              <input id="match-case" type="checkbox" class="rounded text-emerald-600 focus:ring-emerald-500" />
              <label for="match-case">Match case</label>
            </div>
          </div>
          <div class="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
            <button onclick="document.getElementById('modal-backdrop').remove()" class="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
            <button id="btn-do-replace" class="px-4 py-1.5 text-sm bg-emerald-600 text-white font-medium rounded hover:bg-emerald-700 shadow-sm transition-colors">Replace all</button>
          </div>
        </div>
      </div>
    `;
  }

  public renderFunctionsModal(): string {
    const fns = [
      { name: 'SUM', cat: 'Math', desc: 'Adds all numbers in a range of cells.', syntax: 'SUM(A1:A10)' },
      { name: 'AVERAGE', cat: 'Math', desc: 'Returns the numerical average value in a dataset.', syntax: 'AVERAGE(B1:B20)' },
      { name: 'COUNT', cat: 'Math', desc: 'Counts the number of numeric cells.', syntax: 'COUNT(A1:D10)' },
      { name: 'COUNTA', cat: 'Math', desc: 'Counts values that are not empty.', syntax: 'COUNTA(A1:A50)' },
      { name: 'MIN / MAX', cat: 'Math', desc: 'Returns minimum or maximum value.', syntax: 'MIN(C1:C10) or MAX(C1:C10)' },
      { name: 'ROUND', cat: 'Math', desc: 'Rounds a number to a certain number of decimal places.', syntax: 'ROUND(12.345, 2)' },
      { name: 'IF', cat: 'Logical', desc: 'Returns one value if condition is TRUE and another if FALSE.', syntax: 'IF(A1>100, "High", "Low")' },
      { name: 'IFS', cat: 'Logical', desc: 'Evaluates multiple conditions and returns matching value.', syntax: 'IFS(A1>90, "A", A1>80, "B")' },
      { name: 'AND / OR', cat: 'Logical', desc: 'Tests multiple logical expressions.', syntax: 'AND(A1>0, B1>0)' },
      { name: 'CONCAT', cat: 'Text', desc: 'Concatenates strings together.', syntax: 'CONCAT(A1, " ", B1)' },
      { name: 'TEXTJOIN', cat: 'Text', desc: 'Combines multiple text strings with a delimiter.', syntax: 'TEXTJOIN(", ", TRUE, A1:A5)' },
      { name: 'UPPER / LOWER', cat: 'Text', desc: 'Converts text to uppercase or lowercase.', syntax: 'UPPER(A1)' },
      { name: 'TRIM', cat: 'Text', desc: 'Removes leading, trailing, and repeated spaces.', syntax: 'TRIM(A1)' },
      { name: 'VLOOKUP', cat: 'Lookup', desc: 'Vertical lookup in the first column of a range.', syntax: 'VLOOKUP("Item", A1:C10, 2, FALSE)' },
      { name: 'INDEX / MATCH', cat: 'Lookup', desc: 'Flexible dynamic lookup.', syntax: 'INDEX(B1:B10, MATCH("Widget", A1:A10))' },
      { name: 'TODAY / NOW', cat: 'Date', desc: 'Returns current date or ISO timestamp.', syntax: 'TODAY() or NOW()' },
    ];

    const rowsHtml = fns
      .map(
        (f) => `
      <tr class="border-b border-gray-100 hover:bg-gray-50 text-xs">
        <td class="px-3 py-2 font-mono font-semibold text-emerald-700">${f.name}</td>
        <td class="px-3 py-2 text-gray-500">${f.cat}</td>
        <td class="px-3 py-2 text-gray-700">${f.desc}</td>
        <td class="px-3 py-2 font-mono text-gray-600 bg-gray-50/50">${f.syntax}</td>
      </tr>
    `
      )
      .join('');

    return `
      <div id="modal-backdrop" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div>
              <h3 class="font-medium text-gray-800 text-base flex items-center gap-2">
                <span class="font-serif italic font-bold text-emerald-600">fx</span> Function reference
              </h3>
              <p class="text-xs text-gray-500 mt-0.5">Explore 30+ supported formulas with client-side reactive DAG recomputation</p>
            </div>
            <button onclick="document.getElementById('modal-backdrop').remove()" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">✕</button>
          </div>
          <div class="overflow-y-auto flex-1 p-4">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-gray-100 text-gray-600 text-left text-xs uppercase font-medium">
                  <th class="px-3 py-2 rounded-l">Function</th>
                  <th class="px-3 py-2">Category</th>
                  <th class="px-3 py-2">Description</th>
                  <th class="px-3 py-2 rounded-r">Example</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          <div class="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button onclick="document.getElementById('modal-backdrop').remove()" class="px-4 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-black transition-colors">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  public renderExportModal(): string {
    const csvData = this.io.exportCSV();
    const jsonData = this.store.exportJSON();

    return `
      <div id="modal-backdrop" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h3 class="font-medium text-gray-800 flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              Export Spreadsheet
            </h3>
            <button onclick="document.getElementById('modal-backdrop').remove()" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">✕</button>
          </div>
          <div class="p-5 space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div class="p-4 border border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50/20 transition cursor-pointer flex flex-col items-center text-center" id="export-csv-btn">
                <span class="text-2xl mb-1">📄</span>
                <span class="text-sm font-semibold text-gray-800">CSV format</span>
                <span class="text-xs text-gray-500 mt-1">Export active sheet as RFC 4180 CSV</span>
              </div>
              <div class="p-4 border border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50/20 transition cursor-pointer flex flex-col items-center text-center" id="export-json-btn">
                <span class="text-2xl mb-1">📦</span>
                <span class="text-sm font-semibold text-gray-800">JSON workbook</span>
                <span class="text-xs text-gray-500 mt-1">Export all sheets, formulas and styles</span>
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Preview</label>
              <textarea readonly class="w-full h-32 px-3 py-2 border border-gray-200 rounded font-mono text-xs text-gray-600 bg-gray-50 resize-none focus:outline-none">${csvData.substring(0, 500)}${csvData.length > 500 ? '...' : ''}</textarea>
            </div>
          </div>
          <div class="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <span class="text-xs text-gray-400">100% client side download</span>
            <button onclick="document.getElementById('modal-backdrop').remove()" class="px-4 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-black transition-colors">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  public renderImportModal(): string {
    return `
      <div id="modal-backdrop" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h3 class="font-medium text-gray-800 flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Import CSV / Data
            </h3>
            <button onclick="document.getElementById('modal-backdrop').remove()" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">✕</button>
          </div>
          <div class="p-5 space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Choose CSV or JSON file</label>
              <input id="import-file-input" type="file" accept=".csv,.json,.txt" class="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" />
            </div>
            <div class="relative flex py-1 items-center">
              <div class="flex-grow border-t border-gray-200"></div>
              <span class="flex-shrink mx-3 text-xs text-gray-400 font-medium">OR PASTE RAW CSV</span>
              <div class="flex-grow border-t border-gray-200"></div>
            </div>
            <div>
              <textarea id="import-raw-textarea" placeholder="Col1,Col2,Col3\n10,20,30" class="w-full h-28 px-3 py-2 border border-gray-300 rounded font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"></textarea>
            </div>
          </div>
          <div class="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
            <button onclick="document.getElementById('modal-backdrop').remove()" class="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
            <button id="btn-do-import" class="px-4 py-1.5 text-sm bg-emerald-600 text-white font-medium rounded hover:bg-emerald-700 shadow-sm transition-colors">Import data</button>
          </div>
        </div>
      </div>
    `;
  }

  public renderShortcutsModal(): string {
    const shortcuts = [
      { key: 'Enter', desc: 'Confirm edit and move down' },
      { key: 'Tab', desc: 'Confirm edit and move right' },
      { key: 'Shift + Enter', desc: 'Move up' },
      { key: 'Shift + Tab', desc: 'Move left' },
      { key: 'Arrows', desc: 'Navigate grid cells' },
      { key: 'Shift + Arrows', desc: 'Expand rectangular range selection' },
      { key: 'Double Click / F2', desc: 'Edit active cell' },
      { key: 'Escape', desc: 'Cancel editing cell' },
      { key: 'Delete / Backspace', desc: 'Clear active cell contents' },
      { key: 'Ctrl + Z', desc: 'Undo last action' },
      { key: 'Ctrl + Y', desc: 'Redo last undone action' },
      { key: 'Ctrl + B', desc: 'Toggle bold styling' },
      { key: 'Ctrl + I', desc: 'Toggle italic styling' },
      { key: 'Ctrl + U', desc: 'Toggle underline styling' },
      { key: 'Ctrl + C / V', desc: 'Copy and paste TSV data' },
      { key: 'Drag handle', desc: 'Drag bottom-right square to autofill formulas' },
    ];

    const listHtml = shortcuts
      .map(
        (s) => `
      <div class="flex items-center justify-between py-2 border-b border-gray-100 text-xs">
        <span class="text-gray-600">${s.desc}</span>
        <kbd class="px-2 py-1 bg-gray-100 border border-gray-300 rounded font-mono font-medium text-gray-800 shadow-xs">${s.key}</kbd>
      </div>
    `
      )
      .join('');

    return `
      <div id="modal-backdrop" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h3 class="font-medium text-gray-800 flex items-center gap-2">
              <span class="text-base">⌨️</span> Keyboard Shortcuts
            </h3>
            <button onclick="document.getElementById('modal-backdrop').remove()" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">✕</button>
          </div>
          <div class="p-5 max-h-[60vh] overflow-y-auto">
            ${listHtml}
          </div>
          <div class="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button onclick="document.getElementById('modal-backdrop').remove()" class="px-4 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-black transition-colors">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  public renderWebMcpInfo(): string {
    const tools = this.webmcp.getRegisteredTools();
    const toolsList = tools
      .map(
        (t) => `
      <div class="border border-gray-200 rounded p-2.5 bg-gray-50/50 hover:bg-white transition">
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs font-bold text-emerald-700">${t.name}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded ${t.readOnly ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">${t.readOnly ? 'read-only' : 'read-write'}</span>
        </div>
        <p class="text-xs text-gray-600 mt-1">${t.description}</p>
      </div>
    `
      )
      .join('');

    return `
      <div id="modal-backdrop" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div>
              <h3 class="font-medium text-gray-800 text-base flex items-center gap-2">
                <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                WebMCP & fastwebmcp Architecture
              </h3>
              <p class="text-xs text-gray-500 mt-0.5">Compliant with webmcp.com standards & W3C Web Machine Learning specification</p>
            </div>
            <button onclick="document.getElementById('modal-backdrop').remove()" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">✕</button>
          </div>
          <div class="overflow-y-auto flex-1 p-6 space-y-4 text-xs text-gray-700 leading-relaxed">
            <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
              <span class="text-xl">🤖</span>
              <div>
                <strong class="text-emerald-900 block font-semibold">Autonomous AI Agent Ready</strong>
                This spreadsheet exposes 12 declarative and imperative tools directly into the browser context via <code class="bg-white/80 px-1 py-0.5 rounded text-emerald-800">navigator.modelContext</code> and <code class="bg-white/80 px-1 py-0.5 rounded text-emerald-800">fastwebmcp</code>. AI agents can inspect, edit, calculate, and format cells programmatically.
              </div>
            </div>

            <div>
              <h4 class="font-semibold text-gray-800 text-xs uppercase tracking-wider mb-2">Exposed WebMCP Tools (${tools.length})</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                ${toolsList}
              </div>
            </div>
          </div>
          <div class="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <a href="https://webmcp.com" target="_blank" rel="noopener" class="text-xs text-emerald-600 hover:underline">Learn more at webmcp.com &#8599;</a>
            <button onclick="document.getElementById('modal-backdrop').remove()" class="px-4 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-black transition-colors">Close</button>
          </div>
        </div>
      </div>
    `;
  }
}
