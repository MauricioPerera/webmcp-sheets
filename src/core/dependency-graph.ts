import { CellStore, coordsToRef } from './cell-store';
import { FormulaEngine } from './formula-engine';

export class DependencyGraph {
  private store: CellStore;
  private engine: FormulaEngine;

  // Map: cellRef -> Set of cellRefs that this cell depends ON (upstream)
  private dependencies: Map<string, Set<string>> = new Map();

  // Map: cellRef -> Set of cellRefs that depend on THIS cell (downstream dependents)
  private dependents: Map<string, Set<string>> = new Map();

  constructor(store: CellStore, engine: FormulaEngine) {
    this.store = store;
    this.engine = engine;
  }

  /**
   * Registers or updates dependencies when a cell's formula is modified.
   */
  public updateCellDependencies(cellRef: string, formula: string, sheetId?: string): { hasCycle: boolean } {
    const key = this.normalizeRef(cellRef, sheetId);

    // 1. Remove old dependencies
    const oldDeps = this.dependencies.get(key);
    if (oldDeps) {
      for (const dep of oldDeps) {
        this.dependents.get(dep)?.delete(key);
      }
      this.dependencies.delete(key);
    }

    // 2. If not a formula, no new dependencies
    if (!formula.trim().startsWith('=')) {
      return { hasCycle: false };
    }

    // 3. Extract new dependencies
    const activeSheet = sheetId ? this.store.getSheetById(sheetId) : this.store.getActiveSheet();
    const extracted = this.engine.extractDependencies(formula, activeSheet?.name);
    const newDeps = new Set<string>();

    for (const ref of extracted) {
      const norm = this.normalizeRef(ref, sheetId);
      newDeps.add(norm);
    }

    // 4. Cycle Detection before committing
    if (this.detectCycle(key, newDeps)) {
      // Set cycle error on the cell
      this.store.setCell(cellRef, { error: '#CYCLE!', computed: '#CYCLE!' }, sheetId, false);
      return { hasCycle: true };
    }

    // 5. Commit valid dependencies
    this.dependencies.set(key, newDeps);
    for (const dep of newDeps) {
      if (!this.dependents.has(dep)) {
        this.dependents.set(dep, new Set());
      }
      this.dependents.get(dep)!.add(key);
    }

    return { hasCycle: false };
  }

  /**
   * Checks whether adding edges from `newDeps` to `targetCell` would create a directed cycle.
   */
  public detectCycle(targetCell: string, newDeps: Set<string>): boolean {
    if (newDeps.has(targetCell)) {
      return true;
    }

    const visited = new Set<string>();
    const queue = Array.from(newDeps);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetCell) {
        return true;
      }
      if (!visited.has(current)) {
        visited.add(current);
        const upstreams = this.dependencies.get(current);
        if (upstreams) {
          for (const up of upstreams) {
            if (up === targetCell) return true;
            if (!visited.has(up)) queue.push(up);
          }
        }
      }
    }

    return false;
  }

  /**
   * Re-evaluates target cell and cascades recomputation downstream in topological order.
   */
  public recalculate(startCellRef: string, sheetId?: string): void {
    const startKey = this.normalizeRef(startCellRef, sheetId);

    // 1. Evaluate the starter cell itself
    this.evaluateSingleCell(startCellRef, sheetId);

    // 2. Gather all downstream dependents
    const affected = this.getTransitiveDependents(startKey);
    if (affected.length === 0) return;

    // 3. Topologically sort affected cells
    const sorted = this.topologicalSort(affected);

    // 4. Re-evaluate each cell in order
    for (const key of sorted) {
      const { ref, targetSheetId } = this.denormalizeRef(key);
      this.evaluateSingleCell(ref, targetSheetId);
    }
  }

  /**
   * Evaluates all formula cells in the workbook (e.g. on full sheet reload/import).
   */
  public recalculateAll(): void {
    for (const sheet of this.store.getSheets()) {
      for (const [ref, cell] of Object.entries(sheet.cells)) {
        this.updateCellDependencies(ref, cell.raw, sheet.id);
      }
    }

    // Topologically evaluate all cells
    const allCells = Array.from(this.dependencies.keys());
    const sorted = this.topologicalSort(allCells);
    for (const key of sorted) {
      const { ref, targetSheetId } = this.denormalizeRef(key);
      this.evaluateSingleCell(ref, targetSheetId);
    }
  }

  private evaluateSingleCell(cellRef: string, sheetId?: string): void {
    const cell = this.store.getCell(cellRef, sheetId);
    if (!cell) return;

    if (cell.raw.startsWith('=')) {
      const { value, error } = this.engine.evaluate(cell.raw, sheetId);
      this.store.setCell(
        cellRef,
        {
          computed: value,
          error: error || null,
        },
        sheetId,
        false
      );
    } else {
      // Raw literal
      const { value } = this.engine.evaluate(cell.raw, sheetId);
      this.store.setCell(
        cellRef,
        {
          computed: value,
          error: null,
        },
        sheetId,
        false
      );
    }
  }

  private getTransitiveDependents(startKey: string): string[] {
    const visited = new Set<string>();
    const queue = [startKey];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const downstreams = this.dependents.get(curr);
      if (downstreams) {
        for (const down of downstreams) {
          if (!visited.has(down)) {
            visited.add(down);
            queue.push(down);
          }
        }
      }
    }

    return Array.from(visited);
  }

  private topologicalSort(nodes: string[]): string[] {
    const nodeSet = new Set(nodes);
    const inDegree: Map<string, number> = new Map();

    for (const node of nodes) {
      inDegree.set(node, 0);
    }

    for (const node of nodes) {
      const deps = this.dependencies.get(node);
      if (deps) {
        for (const dep of deps) {
          if (nodeSet.has(dep)) {
            inDegree.set(node, (inDegree.get(node) || 0) + 1);
          }
        }
      }
    }

    const queue: string[] = [];
    for (const [node, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(node);
      }
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      sorted.push(curr);

      const downstreams = this.dependents.get(curr);
      if (downstreams) {
        for (const down of downstreams) {
          if (nodeSet.has(down)) {
            const newDeg = (inDegree.get(down) || 1) - 1;
            inDegree.set(down, newDeg);
            if (newDeg === 0) {
              queue.push(down);
            }
          }
        }
      }
    }

    // Include any remaining nodes (if any)
    for (const node of nodes) {
      if (!sorted.includes(node)) {
        sorted.push(node);
      }
    }

    return sorted;
  }

  private normalizeRef(ref: string, sheetId?: string): string {
    const clean = ref.trim().toUpperCase();
    if (clean.includes('!')) {
      const [sheetName, cell] = clean.split('!');
      const sheet = this.store.getSheetByName(sheetName);
      return `${sheet?.id || sheetName}!${cell}`;
    }
    const currentId = sheetId || this.store.getActiveSheet().id;
    return `${currentId}!${clean}`;
  }

  private denormalizeRef(normalized: string): { ref: string; targetSheetId?: string } {
    if (normalized.includes('!')) {
      const [targetSheetId, ref] = normalized.split('!');
      return { ref, targetSheetId };
    }
    return { ref: normalized };
  }
}
