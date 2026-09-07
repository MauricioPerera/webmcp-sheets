---
type: 'Task Contract'
title: 'Implement Importer & Exporter'
description: 'RFC 4180 CSV serialization, CSV parsing, JSON workbook backups, and clipboard TSV support.'
tags: ['ccdd', 'csv', 'tsv', 'importer', 'exporter']
task: importer_exporter
intent: 'Implement standard CSV RFC 4180 import/export, full JSON workbook backup, and TSV clipboard copy-paste.'
target: src/core/importer-exporter.ts
signature: 'export class ImporterExporter'
test_command: 'npm test -- tests/importer-exporter.test.ts'
budget:
  cyclomatic_max: 20
  nesting_max: 5
  lines_max: 500
tests: tests/importer-exporter.test.ts
tests_sha256: 62be079066c5a2dca6f472dbefd50795f496d7fa77fe22106849f09fb87f36fb
deps_allowed: []
touch_only: ['src/core/importer-exporter.ts']
forbids: ['node:fs']
---

# Task Contract: Importer & Exporter

## Intent
Provide robust, standards-compliant CSV and TSV serialization and deserialization conforming to RFC 4180.

## Interface
```typescript
export class ImporterExporter {
  exportCSV(sheetId?: string, useFormulas?: boolean): string;
  importCSV(csvContent: string, sheetId?: string, clearExisting?: boolean): boolean;
  parseCSV(text: string): string[][];
  exportTSV(startCol: number, startRow: number, endCol: number, endRow: number, sheetId?: string): string;
  pasteTSV(tsv: string, startCol: number, startRow: number, sheetId?: string): void;
}
```

## Invariants
- Embedded commas and newlines inside quoted CSV cells must be escaped with double quotes `""`.
- Parsing malformed or partial CSV files must not crash the spreadsheet.

## Examples
- `Name,Price\n"Widget, Deluxe",99.95` correctly parses into 2 rows with an escaped comma.
- Copying a 2x2 range generates standard TSV format for clipboard transfer.

## Do / Don't
- **DO:** Support RFC 4180 quote doubling (`""`) for quotes inside cell strings.
- **DON'T:** Use naive string splitting by comma that corrupts quoted data.

## Tests
Verified by frozen oracle test suite `tests/importer-exporter.test.ts`.

## Constraints
PARAR y reportar si se produce una discrepancia en el conteo de campos CSV que no respete las reglas de escape de RFC 4180.
