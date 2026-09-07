---
type: 'Task Contract'
title: 'Implement HTMX Router'
description: 'Client-side hypermedia router for HTMX partials without backend dependencies.'
tags: ['ccdd', 'htmx', 'hypermedia', 'router']
task: htmx_router
intent: 'Intercept HTMX requests client-side and return HTML partials for modals, dialogs, and statistics.'
target: src/ui/htmx-router.ts
signature: 'export class HtmxRouter'
test_command: 'npm test -- tests/htmx-router.test.ts'
budget:
  cyclomatic_max: 15
  nesting_max: 4
  lines_max: 500
tests: tests/htmx-router.test.ts
tests_sha256: a0af1c4fc735961a53216fc369720e4f15538c75748d3a44d98badc02b73c911
deps_allowed: []
touch_only: ['src/ui/htmx-router.ts']
forbids: ['node:http', 'external-server']
---

# Task Contract: HTMX Router

## Intent
Provide declarative hypermedia interactions driven by HTMX attributes in a 100% client-side environment as specified in [hypermedia_htmx_arch.md](../architecture/hypermedia_htmx_arch.md).

## Interface
```typescript
export class HtmxRouter {
  renderRoute(path: string): string;
  renderFindReplaceModal(): string;
  renderFunctionsModal(): string;
  renderExportModal(): string;
  renderImportModal(): string;
  renderShortcutsModal(): string;
  renderWebMcpInfo(): string;
}
```

## Invariants
- Synthetic route requests must be resolved in-memory without initiating network requests.
- Returned HTML fragments must contain semantic markup compatible with HTMX swapping.

## Examples
- Requesting `/modal/find-replace` returns the Find & Replace modal partial.
- Requesting `/modal/functions` returns the 30+ formula reference table.

## Do / Don't
- **DO:** Render clean Tailwind CSS styled modal dialogs and drawers.
- **DON'T:** Issue unhandled fetch calls that result in 404 network errors.

## Tests
Verified by frozen oracle test suite `tests/htmx-router.test.ts`.

## Constraints
PARAR y reportar si una ruta requerida no genera un fragmento HTML válido o si el interceptor permite que las peticiones se escapen al servidor.
