import { describe, it, expect, beforeEach } from 'vitest';
import { CellStore } from '../src/core/cell-store';
import { FormulaEngine } from '../src/core/formula-engine';
import { DependencyGraph } from '../src/core/dependency-graph';

describe('DependencyGraph & Reactivity', () => {
  let store: CellStore;
  let engine: FormulaEngine;
  let dag: DependencyGraph;

  beforeEach(() => {
    store = new CellStore();
    engine = new FormulaEngine(store);
    dag = new DependencyGraph(store, engine);
  });

  it('cascades updates downstream when an upstream cell changes', () => {
    store.setCellRaw('A1', '10');
    store.setCellRaw('B1', '=A1 * 2');
    store.setCellRaw('C1', '=B1 + 5');

    dag.updateCellDependencies('B1', '=A1 * 2');
    dag.updateCellDependencies('C1', '=B1 + 5');

    dag.recalculate('A1');

    expect(store.getCell('B1')?.computed).toBe(20);
    expect(store.getCell('C1')?.computed).toBe(25);

    // Update A1 and verify cascade
    store.setCellRaw('A1', '50');
    dag.recalculate('A1');

    expect(store.getCell('B1')?.computed).toBe(100);
    expect(store.getCell('C1')?.computed).toBe(105);
  });

  it('detects self-referencing circular dependency', () => {
    store.setCellRaw('A1', '=A1 + 1');
    const { hasCycle } = dag.updateCellDependencies('A1', '=A1 + 1');
    expect(hasCycle).toBe(true);
    expect(store.getCell('A1')?.error).toBe('#CYCLE!');
  });

  it('detects mutual circular dependencies A1 -> B1 -> A1', () => {
    store.setCellRaw('A1', '=B1 + 1');
    dag.updateCellDependencies('A1', '=B1 + 1');

    store.setCellRaw('B1', '=A1 + 2');
    const { hasCycle } = dag.updateCellDependencies('B1', '=A1 + 2');

    expect(hasCycle).toBe(true);
    expect(store.getCell('B1')?.error).toBe('#CYCLE!');
  });
});
