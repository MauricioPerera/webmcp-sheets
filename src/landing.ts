import { CellStore } from "./core/cell-store";
import { FormulaEngine } from "./core/formula-engine";
import { DependencyGraph } from "./core/dependency-graph";
import { ImporterExporter } from "./core/importer-exporter";
import { WebMcpService } from "./core/webmcp-service";

// 1. Initialize WebMCP runtime on Landing Page for agents and headless crawlers
const store = new CellStore();
const engine = new FormulaEngine(store);
const dag = new DependencyGraph(store, engine);
const io = new ImporterExporter(store);
const webmcp = new WebMcpService(store, engine, dag, io);

// Attach globally for browser developer console & agents
(window as any).WebMCP = {
  execute: (toolName: string, args: Record<string, unknown> = {}) => webmcp.executeTool(toolName, args),
  getTools: () => webmcp.getRegisteredTools(),
  getLogs: () => webmcp.getExecutionLogs(),
};

// 2. Interactive Formula Calculator on Landing Page
document.addEventListener("DOMContentLoaded", () => {
  const formulaInput = document.getElementById("hero-formula-input") as HTMLInputElement;
  const evalBtn = document.getElementById("hero-eval-btn") as HTMLButtonElement;
  const resultDisplay = document.getElementById("hero-eval-result") as HTMLElement;
  const chipButtons = document.querySelectorAll<HTMLButtonElement>(".formula-chip");

  const runEvaluation = (expr: string) => {
    if (!expr) return;
    const formatted = expr.startsWith("=") ? expr : "=" + expr;
    const res = engine.evaluate(formatted);
    if (resultDisplay) {
      if (res.error) {
        resultDisplay.textContent = res.error;
        resultDisplay.className = "text-red-500 font-mono font-bold text-lg";
      } else {
        resultDisplay.textContent = String(res.value);
        resultDisplay.className = "text-emerald-400 font-mono font-bold text-lg";
      }
    }
  };

  if (evalBtn && formulaInput) {
    evalBtn.addEventListener("click", () => runEvaluation(formulaInput.value));
    formulaInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runEvaluation(formulaInput.value);
    });
  }

  chipButtons.forEach((chip) => {
    chip.addEventListener("click", () => {
      const formula = chip.getAttribute("data-formula") || "";
      if (formulaInput) formulaInput.value = formula;
      runEvaluation(formula);
    });
  });

  // 3. WebMCP Live Probe Demo
  const webmcpRunBtn = document.getElementById("webmcp-probe-btn");
  const webmcpOutput = document.getElementById("webmcp-probe-output");
  if (webmcpRunBtn && webmcpOutput) {
    webmcpRunBtn.addEventListener("click", async () => {
      webmcpOutput.textContent = "Ejecutando sheets_evaluate_formula...";
      try {
        const res = await webmcp.executeTool("sheets_evaluate_formula", {
          formula: "=SUM(120, 280, 450) * 1.16",
        });
        webmcpOutput.textContent = JSON.stringify(res, null, 2);
      } catch (err: any) {
        webmcpOutput.textContent = "Error: " + (err?.message || String(err));
      }
    });
  }

  // 4. Formula Catalog Category Filtering
  const filterBtns = document.querySelectorAll<HTMLButtonElement>(".cat-filter-btn");
  const formulaCards = document.querySelectorAll<HTMLElement>(".formula-card");

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active-cat", "bg-emerald-600", "text-white"));
      filterBtns.forEach((b) => b.classList.add("bg-gray-800", "text-gray-300"));
      btn.classList.remove("bg-gray-800", "text-gray-300");
      btn.classList.add("active-cat", "bg-emerald-600", "text-white");

      const cat = btn.getAttribute("data-category");
      formulaCards.forEach((card) => {
        if (cat === "all" || card.getAttribute("data-category") === cat) {
          card.classList.remove("hidden");
        } else {
          card.classList.add("hidden");
        }
      });
    });
  });
});
