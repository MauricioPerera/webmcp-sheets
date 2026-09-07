# WebMCP Sheets — 100% Client-Side Google Sheets Clone

A 100% functional, responsive **Google Sheets** clone deployable directly to **GitHub Pages** (100% client-side, zero server required). Built with **Tailwind CSS**, **HTMX**, governed by **Knowledge-Driven Development (KDD)** from [MauricioPerera/KDD](https://github.com/MauricioPerera/KDD), and powered by **FastWebMCP** & [webmcp.com](https://webmcp.com) standards.

### 🌐 Live Deployments
- 🚀 **Landing Page**: [https://mauricioperera.github.io/webmcp-sheets/](https://mauricioperera.github.io/webmcp-sheets/)
- 📊 **Spreadsheet Application**: [https://mauricioperera.github.io/webmcp-sheets/app.html](https://mauricioperera.github.io/webmcp-sheets/app.html)
- 🤖 **LLM Directives & Context**: [`/llms.txt`](https://mauricioperera.github.io/webmcp-sheets/llms.txt) | [`/llms-full.txt`](https://mauricioperera.github.io/webmcp-sheets/llms-full.txt)

---

## Key Features

### 1. Authentic Google Sheets Interface & Experience
- **Header & Menu Ribbon**: File, Edit, View, Insert, Tools, Help with interactive dropdown actions and document title renaming with localStorage auto-persistence.
- **Action Toolbar**: Undo (`Ctrl+Z`), Redo (`Ctrl+Y`), Print (`Ctrl+P`), Number formats (`$`, `%`, `.0`, `.00`), Bold (`Ctrl+B`), Italic (`Ctrl+I`), Strikethrough, Text Color, Fill Color, Alignment (Left, Center, Right), Quick Function insertion (`∑`).
- **Formula Bar**: Active coordinate name box (`A1`), `✕` cancel, `✓` accept, and `fx` function helper with synchronized editing.
- **Spreadsheet Grid**:
  - Resizable column headers (`A..Z`, `AA..`) and row headers (`1..100+`).
  - Active cell indicator with 2px emerald outline.
  - Multi-cell rectangular selection with Shift + Arrows or mouse dragging.
  - **Drag-to-Fill Handle**: Bottom-right square handle on active selection allows dragging across or down to auto-fill formulas (smart reference shifting `=A1+B1` -> `=A2+B2`) or numeric sequences.
  - In-cell editor: Double click or press Enter/F2 or type any character to edit inline.
  - Full keyboard shortcuts: Arrow navigation, Tab, Enter, Shift+Enter, Shift+Tab, Escape, Delete, Backspace.
  - Clipboard TSV integration: Copy (`Ctrl+C`) and Paste (`Ctrl+V`) directly from/to Microsoft Excel or Google Sheets.

### 2. Powerful Formula Engine (30+ Functions) & Reactive DAG
- Formulas starting with `=`:
  - **Math**: `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `COUNTBLANK`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `ABS`, `MOD`, `POWER`, `SQRT`, `PRODUCT`, `INT`, `MEDIAN`.
  - **Logical**: `IF`, `IFS`, `AND`, `OR`, `NOT`, `ISBLANK`, `ISNUMBER`, `ISTEXT`.
  - **Text**: `CONCAT`, `CONCATENATE`, `TEXTJOIN`, `TRIM`, `UPPER`, `LOWER`, `PROPER`, `LEN`, `LEFT`, `RIGHT`, `MID`.
  - **Lookup**: `VLOOKUP`, `INDEX`, `MATCH`.
  - **Date**: `TODAY`, `NOW`, `YEAR`, `MONTH`, `DAY`.
- **Reactive Dependency Graph (DAG)**:
  - Inter-cell dependency tracking.
  - Circular dependency detection (`#CYCLE!`).
  - Topological re-evaluation cascading updates cleanly downstream.

### 3. Multi-Sheet Tabs & Live Status Bar
- Multi-sheet workbook tabs (`Sheet1`, `Sheet2`, add new sheet `+`, rename, delete).
- Real-time aggregate statistics bar at bottom right: `Count`, `Sum`, `Average`, `Min`, `Max` dynamically computed for the highlighted range.

### 4. Data Import & Export
- RFC 4180 compliant CSV export and import (escapes quotes, commas, newlines).
- Complete JSON workbook export and import (preserves multi-sheet data, formulas, formats).
- TSV clipboard copy and paste.

### 5. Client-Side Hypermedia Architecture with HTMX
- HTMX declarative workflows drive modals and panels without any server backend:
  - `/modal/find-replace`: Find & replace dialog.
  - `/modal/functions`: Interactive 30+ formula reference table with examples.
  - `/modal/export`: CSV and JSON download modal.
  - `/modal/import`: CSV file upload and raw CSV paste modal.
  - `/modal/shortcuts`: Keyboard shortcuts guide.
  - `/panel/webmcp-info`: WebMCP capabilities and architecture panel.

### 6. FastWebMCP & webmcp.com Integration
- Exposes 12 declarative and imperative tools according to the W3C Web Machine Learning WebMCP draft and FastWebMCP:
  1. `sheets_get_cell({ sheet, cell })`
  2. `sheets_set_cell({ sheet, cell, value, format })`
  3. `sheets_get_range({ sheet, range })`
  4. `sheets_set_range({ sheet, startCell, values })`
  5. `sheets_evaluate_formula({ formula, sheet })`
  6. `sheets_clear_range({ sheet, range })`
  7. `sheets_create_sheet({ name })`
  8. `sheets_delete_sheet({ name })`
  9. `sheets_list_sheets()`
  10. `sheets_find_replace({ find, replace, sheet, matchCase })`
  11. `sheets_export_data({ format, sheet })`
  12. `sheets_get_summary({ sheet })`
- Browser-native `navigator.modelContext` support with automatic fallback polyfill.
- Built-in **WebMCP AI Agent Console**: An interactive drawer to test directives (e.g. "Generate monthly budget", "Format headers", "Calculate column totals") and view real-time tool execution logs.
- Declarative `<form toolname="...">` autonomous discovery surface for browser crawlers and LLM agents.

---

## Knowledge-Driven Development (KDD) Structure

Governed according to [MauricioPerera/KDD](https://github.com/MauricioPerera/KDD):

- `knowledge/`: OKF knowledge nodes:
  - `OKF-SPEC.md`: OKF specification standard.
  - `index.md`: Navigation index.
  - `data_models/`: `cell_model.md`, `workbook_model.md`, `formula_ast.md`, `webmcp_protocol.md`.
  - `architecture/`: `formula_engine_arch.md`, `reactive_dag_arch.md`, `hypermedia_htmx_arch.md`, `webmcp_bridge_arch.md`.
- `knowledge/contracts/`: CCDD Task Contracts with YAML frontmatter, frozen oracle test hashes, and cyclomatic complexity budgets:
  - `contract_cell_store.md`
  - `contract_formula_engine.md`
  - `contract_reactive_dag.md`
  - `contract_importer_exporter.md`
  - `contract_webmcp_bridge.md`
  - `contract_htmx_router.md`
- `scripts/`:
  - `validate_contracts.py`: Deterministic contract validator.
  - `validate_okf.py`: OKF conformance validator.
  - `lint_ascii.py`: ASCII integrity validator.

---

## Quick Start

### Install & Run Locally
```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Run automated tests
npm test

# Run full KDD validation gate
npm run kdd:validate

# Build static bundle for production / GitHub Pages
npm run build
```

---

## Deploy to GitHub Pages

1. Push this repository to GitHub on the `main` branch.
2. In your GitHub repository:
   - Go to **Settings** > **Pages**.
   - Under **Build and deployment**, select **GitHub Actions** as the source.
3. The included workflow `.github/workflows/deploy.yml` will automatically validate contracts, run tests, build the static site, and deploy it to `https://<username>.github.io/<repo>/`.
