import { WebMcpService } from '../core/webmcp-service';
import { CellStore, coordsToRef } from '../core/cell-store';
import { DependencyGraph } from '../core/dependency-graph';
import { SpreadsheetGrid } from './grid';
import { WebMcpExecutionLog } from '../core/types';

export class AgentDrawer {
  private container: HTMLElement;
  private webmcp: WebMcpService;
  private store: CellStore;
  private dag: DependencyGraph;
  private grid: SpreadsheetGrid;

  private isOpen = false;

  constructor(
    containerId: string,
    webmcp: WebMcpService,
    store: CellStore,
    dag: DependencyGraph,
    grid: SpreadsheetGrid
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.webmcp = webmcp;
    this.store = store;
    this.dag = dag;
    this.grid = grid;

    this.render();
    this.attachEvents();

    this.webmcp.onLog(() => {
      if (this.isOpen) {
        this.renderLogs();
      }
    });
  }

  public toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.container.classList.remove('translate-x-full');
      this.renderLogs();
    } else {
      this.container.classList.add('translate-x-full');
    }
  }

  private render(): void {
    const tools = this.webmcp.getRegisteredTools();

    this.container.innerHTML = `
      <div class="h-full flex flex-col bg-white border-l border-gray-200 shadow-2xl text-xs w-96 max-w-full">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 class="font-semibold text-gray-800 text-sm">WebMCP AI Agent Console</h3>
          </div>
          <button id="btn-close-agent-drawer" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">✕</button>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex border-b border-gray-200 bg-gray-100/60 px-2 pt-1 gap-1">
          <button id="tab-btn-prompt" class="px-3 py-1.5 font-medium border-b-2 border-emerald-600 text-emerald-800 bg-white rounded-t">
            Agent Prompt
          </button>
          <button id="tab-btn-logs" class="px-3 py-1.5 font-medium text-gray-500 hover:text-gray-700">
            Tool Logs
          </button>
          <button id="tab-btn-tools" class="px-3 py-1.5 font-medium text-gray-500 hover:text-gray-700">
            Catalogue (${tools.length})
          </button>
        </div>

        <!-- Tab 1: Agent Prompt Simulator -->
        <div id="tab-content-prompt" class="flex-1 flex flex-col p-4 overflow-y-auto space-y-3">
          <div class="p-3 bg-emerald-50/70 border border-emerald-100 rounded-lg text-emerald-900 leading-relaxed">
            <p class="font-semibold mb-1 flex items-center gap-1.5">
              <span>🤖</span> Autonomous Agent Bridge
            </p>
            Instruct the AI agent to manipulate cells, calculate totals, format tables, or add sheets. The agent calls WebMCP tools in real time.
          </div>

          <!-- Quick action templates -->
          <div>
            <label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Quick Scenarios</label>
            <div class="flex flex-wrap gap-1.5">
              <button class="agent-quick-btn px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200 rounded text-[11px] transition text-left" data-prompt="Generate a monthly household budget table with 4 expense categories and a total row.">
                📊 Monthly budget table
              </button>
              <button class="agent-quick-btn px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200 rounded text-[11px] transition text-left" data-prompt="Set headers in row 1 with bold text and green background.">
                🎨 Format headers
              </button>
              <button class="agent-quick-btn px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200 rounded text-[11px] transition text-left" data-prompt="Add a summary row calculating SUM and AVERAGE for column B.">
                ∑ Calculate column totals
              </button>
            </div>
          </div>

          <!-- Prompt Input Form -->
          <div class="flex-1 flex flex-col justify-end space-y-2 pt-2">
            <label class="block text-[10px] font-semibold text-gray-500 uppercase">Agent Directive</label>
            <textarea
              id="agent-prompt-input"
              rows="3"
              placeholder="e.g. Put 'Product' in A1, 'Price' in B1, and add 3 items with prices, then calculate total."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs text-gray-800 resize-none font-sans"
            ></textarea>
            <button
              id="btn-run-agent"
              class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition"
            >
              <span>Execute with WebMCP</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </div>
        </div>

        <!-- Tab 2: Logs -->
        <div id="tab-content-logs" class="flex-1 p-3 overflow-y-auto hidden space-y-2 font-mono text-[11px]">
          <div id="agent-logs-list" class="space-y-2">
            <div class="text-gray-400 text-center py-6 font-sans">No WebMCP tools invoked yet.</div>
          </div>
        </div>

        <!-- Tab 3: Tools Catalogue -->
        <div id="tab-content-tools" class="flex-1 p-3 overflow-y-auto hidden space-y-2.5">
          ${tools
            .map(
              (t) => `
            <div class="border border-gray-200 rounded p-2.5 bg-gray-50/50 hover:bg-white transition">
              <div class="flex items-center justify-between">
                <span class="font-mono text-xs font-bold text-emerald-700">${t.name}</span>
                <span class="text-[10px] px-1 py-0.5 rounded ${t.readOnly ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">${t.readOnly ? 'read-only' : 'read-write'}</span>
              </div>
              <p class="text-gray-600 text-xs mt-1">${t.description}</p>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  private attachEvents(): void {
    document.getElementById('btn-close-agent-drawer')?.addEventListener('click', () => {
      this.toggle();
    });

    document.getElementById('btn-toggle-agent')?.addEventListener('click', () => {
      this.toggle();
    });

    // Tab switching
    const tabPrompt = document.getElementById('tab-btn-prompt')!;
    const tabLogs = document.getElementById('tab-btn-logs')!;
    const tabTools = document.getElementById('tab-btn-tools')!;

    const contentPrompt = document.getElementById('tab-content-prompt')!;
    const contentLogs = document.getElementById('tab-content-logs')!;
    const contentTools = document.getElementById('tab-content-tools')!;

    const switchTab = (activeTab: HTMLElement, activeContent: HTMLElement) => {
      [tabPrompt, tabLogs, tabTools].forEach((t) => {
        t.className = 'px-3 py-1.5 font-medium text-gray-500 hover:text-gray-700';
      });
      [contentPrompt, contentLogs, contentTools].forEach((c) => c.classList.add('hidden'));

      activeTab.className =
        'px-3 py-1.5 font-medium border-b-2 border-emerald-600 text-emerald-800 bg-white rounded-t';
      activeContent.classList.remove('hidden');
    };

    tabPrompt.addEventListener('click', () => switchTab(tabPrompt, contentPrompt));
    tabLogs.addEventListener('click', () => {
      switchTab(tabLogs, contentLogs);
      this.renderLogs();
    });
    tabTools.addEventListener('click', () => switchTab(tabTools, contentTools));

    // Quick prompt buttons
    document.querySelectorAll('.agent-quick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt') || '';
        const textarea = document.getElementById('agent-prompt-input') as HTMLTextAreaElement;
        if (textarea) {
          textarea.value = prompt;
        }
      });
    });

    // Run Agent Directive
    document.getElementById('btn-run-agent')?.addEventListener('click', async () => {
      const textarea = document.getElementById('agent-prompt-input') as HTMLTextAreaElement;
      const prompt = textarea?.value?.trim();
      if (!prompt) return;

      await this.processAgentDirective(prompt);
      this.renderLogs();
      switchTab(tabLogs, contentLogs);
    });
  }

  private async processAgentDirective(prompt: string): Promise<void> {
    const lower = prompt.toLowerCase();

    // Scenario 1: Budget Table
    if (lower.includes('budget') || lower.includes('expense')) {
      await this.webmcp.executeTool('sheets_set_range', {
        startCell: 'A1',
        values: [
          ['Category', 'Budgeted', 'Actual', 'Variance'],
          ['Housing', '1200', '1150', '=B2-C2'],
          ['Food & Groceries', '450', '480', '=B3-C3'],
          ['Transportation', '250', '220', '=B4-C4'],
          ['Utilities', '180', '190', '=B5-C5'],
          ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)'],
        ],
      });

      // Format header row
      for (let c = 0; c < 4; c++) {
        const ref = coordsToRef(c, 0);
        this.store.setCellFormat(ref, {
          bold: true,
          bgColor: '#e6f4ea',
          textColor: '#137333',
        });
      }

      // Format currency columns
      for (let r = 1; r <= 5; r++) {
        for (let c = 1; c <= 3; c++) {
          const ref = coordsToRef(c, r);
          this.store.setCellFormat(ref, { numberFormat: 'currency', decimals: 2 });
        }
      }

      this.dag.recalculateAll();
      this.grid.render();
      return;
    }

    // Scenario 2: Format Headers
    if (lower.includes('header') || lower.includes('format')) {
      for (let c = 0; c < 6; c++) {
        const ref = coordsToRef(c, 0);
        this.store.setCellFormat(ref, {
          bold: true,
          bgColor: '#d1e7dd',
          textColor: '#0f5132',
          align: 'center',
        });
      }
      this.grid.render();
      return;
    }

    // Scenario 3: Calculate Column Totals
    if (lower.includes('total') || lower.includes('sum')) {
      await this.webmcp.executeTool('sheets_set_cell', {
        cell: 'A7',
        value: 'Total',
        format: { bold: true },
      });
      await this.webmcp.executeTool('sheets_set_cell', {
        cell: 'B7',
        value: '=SUM(B2:B6)',
        format: { bold: true, numberFormat: 'currency' },
      });
      this.dag.recalculateAll();
      this.grid.render();
      return;
    }

    // Fallback: Generic evaluation / insertion
    await this.webmcp.executeTool('sheets_set_cell', {
      cell: 'A1',
      value: prompt,
    });
    this.dag.recalculateAll();
    this.grid.render();
  }

  private renderLogs(): void {
    const list = document.getElementById('agent-logs-list');
    if (!list) return;

    const logs = this.webmcp.getExecutionLogs();
    if (logs.length === 0) {
      list.innerHTML = `<div class="text-gray-400 text-center py-6 font-sans">No WebMCP tools invoked yet.</div>`;
      return;
    }

    list.innerHTML = logs
      .slice(-20)
      .reverse()
      .map((log) => {
        const isOk = log.status === 'success';
        return `
        <div class="p-2.5 rounded border ${isOk ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50/50'} shadow-xs">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold ${isOk ? 'text-emerald-700' : 'text-red-700'}">${log.toolName}</span>
            <span class="text-[10px] text-gray-400">${log.durationMs}ms</span>
          </div>
          <div class="text-[10px] text-gray-600 bg-gray-50 p-1.5 rounded overflow-x-auto">
            <code>${JSON.stringify(log.args)}</code>
          </div>
          ${
            log.result !== undefined
              ? `<div class="mt-1 text-[10px] text-emerald-800 bg-emerald-50/50 p-1.5 rounded overflow-x-auto font-mono">➡ ${JSON.stringify(log.result)}</div>`
              : ''
          }
          ${
            log.error
              ? `<div class="mt-1 text-[10px] text-red-600 font-sans">⚠ ${log.error}</div>`
              : ''
          }
        </div>
      `;
      })
      .join('');
  }
}
