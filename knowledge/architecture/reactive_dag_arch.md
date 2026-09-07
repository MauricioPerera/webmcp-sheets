---
type: 'Architecture'
title: 'Reactive DAG Architecture'
description: 'Directed Acyclic Graph dependency tracking and topological re-evaluation for cells.'
tags: ['dag', 'graph', 'reactivity', 'architecture']
---

# Reactive DAG Architecture

Maintains a Directed Acyclic Graph of dependencies between cells.

## Principles
- When cell `C1` contains `=A1 + B1`, edges `A1 -> C1` and `B1 -> C1` are recorded.
- Cycle Detection: If an edge introduction creates a directed cycle (e.g. `A1 -> B1 -> A1`), circular dependency `#CYCLE!` is triggered.
- Topological Sort: Recomputing affected cells in strict topological order ensures each dependency is evaluated exactly once with fresh data.

Refer to [cell_model.md](../data_models/cell_model.md) and [formula_engine_arch.md](formula_engine_arch.md).
