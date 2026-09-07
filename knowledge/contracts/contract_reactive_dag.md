---
type: 'Task Contract'
title: 'Implement Reactive DAG'
description: 'Dependency tracking, cycle detection, and topological sorting for spreadsheet reactivity.'
tags: ['ccdd', 'dag', 'graph', 'reactivity']
task: reactive_dag
intent: 'Track inter-cell dependencies, detect cycles (#CYCLE!), and recalculate dirty cells in topological order.'
target: src/core/dependency-graph.ts
signature: 'export class DependencyGraph'
test_command: 'npm test -- tests/dependency-graph.test.ts'
budget:
  cyclomatic_max: 20
  nesting_max: 5
  lines_max: 500
tests: tests/dependency-graph.test.ts
tests_sha256: d4bff2e85b7b6b6f8f9f6bb40e6829fbe9803df849cb20ea7d8ba872dfd4ec6e
deps_allowed: []
touch_only: ['src/core/dependency-graph.ts']
forbids: ['async-loops', 'unbounded-recursion']
---

# Task Contract: Reactive DAG

## Intent
Maintain reactive dependency relations across spreadsheet cells as defined in [reactive_dag_arch.md](../architecture/reactive_dag_arch.md).

## Interface
```typescript
export class DependencyGraph {
  updateCellDependencies(cellRef: string, formula: string, sheetId?: string): { hasCycle: boolean };
  detectCycle(targetCell: string, newDeps: Set<string>): boolean;
  recalculate(startCellRef: string, sheetId?: string): void;
  recalculateAll(): void;
}
```

## Invariants
- Circular references (e.g. `A1 -> B1 -> A1`) must be flagged with `#CYCLE!`.
- Downstream dependents must be recomputed in strict topological order.

## Examples
- When `A1 = 10` and `B1 = =A1 * 2`, updating `A1` to `50` automatically cascades `B1` to `100`.
- Setting `A1 = =A1 + 1` sets `#CYCLE!` on `A1`.

## Do / Don't
- **DO:** Clean up stale upstream dependencies when a cell formula changes.
- **DON'T:** Perform infinite recomputation loops when circular references exist.

## Tests
Verified by frozen oracle test suite `tests/dependency-graph.test.ts`.

## Constraints
PARAR y reportar si se detecta un ciclo dirigido no interceptado antes de la fase de reevaluación.
