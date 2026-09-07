---
type: 'Task Contract'
title: 'Implement Cell Store & Workbook State'
description: 'Core state management for multi-sheet workbooks, cell formatting, coordinates, and undo/redo.'
tags: ['ccdd', 'spreadsheet', 'cell', 'store']
task: cell_store
intent: 'Implement workbook state container, coordinate parsing, cell mutations, and undo/redo stacks.'
target: src/core/cell-store.ts
signature: 'export class CellStore'
test_command: 'npm test -- tests/cell-store.test.ts'
budget:
  cyclomatic_max: 15
  nesting_max: 4
  lines_max: 500
tests: tests/cell-store.test.ts
tests_sha256: 2835abdfc837ce88362eb9b17b31b4a29677e8eb837768c6dde8e3175fd28f77
deps_allowed: []
touch_only: ['src/core/cell-store.ts']
forbids: ['node:fs', 'external-state-library']
---

# Task Contract: Cell Store

## Intent
Manage in-memory state for spreadsheet workbooks according to [workbook_model.md](../data_models/workbook_model.md) and [cell_model.md](../data_models/cell_model.md).

## Interface
```typescript
export class CellStore {
  getWorkbook(): WorkbookData;
  getActiveSheet(): SheetData;
  addSheet(name?: string): SheetData;
  deleteSheet(sheetId: string): boolean;
  renameSheet(sheetId: string, newName: string): boolean;
  getCell(ref: string | CellCoord, sheetId?: string): CellData | undefined;
  setCell(ref: string | CellCoord, data: Partial<CellData>, sheetId?: string): void;
  undo(): boolean;
  redo(): boolean;
}
```

## Invariants
- A workbook must always contain at least one active sheet.
- Column indices map bijectively to base-26 letter representations (`0 -> A`, `25 -> Z`, `26 -> AA`).
- Coordinates in cell keys are normalized uppercase (e.g. `A1`).

## Examples
- Setting `A1` with value `100` stores raw `100` and emits a notification.
- Calling `undo()` restores the previous workbook state snapshot.

## Do / Don't
- **DO:** Preserve cell formatting when updating raw values.
- **DON'T:** Directly mutate sheets array without recording history.

## Tests
Verified by frozen oracle test suite `tests/cell-store.test.ts`.

## Constraints
PARAR y reportar si se detecta corrupción de estado o si el usuario intenta eliminar la única hoja activa del libro.
