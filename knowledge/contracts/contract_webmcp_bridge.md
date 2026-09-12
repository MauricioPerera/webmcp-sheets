---
type: 'Task Contract'
title: 'Implement WebMCP Bridge'
description: 'FastWebMCP runtime and WebMCP registry exposing bounded, auditable tools to autonomous AI agents.'
tags: ['ccdd', 'webmcp', 'fastwebmcp', 'agent', 'bridge']
task: webmcp_bridge
intent: 'Expose spreadsheet manipulation capabilities via WebMCP tools with Zod schema validation and browser fallback.'
target: src/core/webmcp-service.ts
signature: 'export class WebMcpService'
test_command: 'npm test -- tests/webmcp-service.test.ts'
budget:
  cyclomatic_max: 20
  nesting_max: 5
  lines_max: 1200
tests: tests/webmcp-service.test.ts
tests_sha256: 5e74c64353175a0d34643c6bd85ee168889db3b5c9fbf58d7901835da2473ea4
deps_allowed: ['zod', 'fastwebmcp']
touch_only: ['src/core/webmcp-service.ts']
forbids: ['eval', 'unvalidated-arguments']
---

# Task Contract: WebMCP Bridge

## Intent
Connect the spreadsheet engine to the Web Model Context Protocol standard as described in [webmcp_bridge_arch.md](../architecture/webmcp_bridge_arch.md) and [webmcp_protocol.md](../data_models/webmcp_protocol.md).

## Interface
```typescript
export class WebMcpService {
  getRegisteredTools(): WebMcpToolMetadata[];
  executeTool(toolName: string, args?: Record<string, unknown>): Promise<unknown>;
  getExecutionLogs(): WebMcpExecutionLog[];
  defineDeclarativeTool(form: HTMLFormElement, spec: any): void;
  respondToAgentSubmit(event: Event, handler: (e: Event) => any): void;
}
```

## Invariants
- All 21 registered tools must validate their input arguments strictly through the shared Zod dispatcher before execution.
- Executed tool operations must be logged with duration, status, and outputs.
- Destructive operations must return a short-lived preview ID and require visible confirmation before they change workbook data.

## Examples
- Calling `sheets_set_cell` with `{ cell: 'B2', value: '42' }` sets the cell value and triggers recomputation.
- Inspecting `getRegisteredTools()` returns all registered tools with metadata.

## Do / Don't
- **DO:** Validate inputs using Zod before calling internal engine methods.
- **DON'T:** Allow execution of unregistered tool names.

## Tests
Verified by frozen oracle test suite `tests/webmcp-service.test.ts`.

## Constraints
PARAR y reportar si una herramienta WebMCP muta el estado sin validación previa del esquema Zod o sin registrar el evento en el log de auditoría.
