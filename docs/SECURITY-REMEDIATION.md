# Security remediation sprint

This sprint addresses the audit findings at commit `8578ac5`.

## Completed

- Dynamic cell values, sheet names, document titles, previews, and agent log data are HTML-escaped before insertion into markup.
- Imported workbooks from JSON and localStorage are structurally validated before replacing application state.
- Batch writes and find/replace create a single undo checkpoint per operation.
- Literal cells are evaluated during full recalculation, and replacing a circular formula clears stale error state.
- Vitest is upgraded to the patched 5.x line.

## Remaining boundaries

- The application is client-side and stores workbook data in browser localStorage; it does not provide encryption at rest.
- WebMCP native registration still needs browser-level verification in a WebMCP-capable client.
- Large ranges and formulas remain subject to browser resource limits; no server-side quota exists.
