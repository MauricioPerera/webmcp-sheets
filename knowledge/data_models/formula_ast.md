---
type: 'Data Model'
title: 'Formula AST Data Model'
description: 'Abstract syntax tree nodes representing tokenized and parsed spreadsheet formulas.'
tags: ['formula', 'ast', 'parser', 'data-model']
---

# Formula AST Data Model

Spreadsheet formulas (starting with `=`) are tokenized and parsed into an Abstract Syntax Tree (AST).

## Node Kinds
- `Literal`: number, string, boolean
- `CellReference`: single coordinate e.g. `A1`, `$B$2`, `Sheet1!C3`
- `RangeReference`: rectangular range e.g. `A1:B10`
- `BinaryOp`: operator e.g. `+`, `-`, `*`, `/`, `^`, `&`, `=`, `<`, `>`, `<=`, `>=`
- `UnaryOp`: operator e.g. `-`, `+`
- `FunctionCall`: function name and argument expressions e.g. `SUM(A1:A10, 5)`

See [formula_engine_arch.md](../architecture/formula_engine_arch.md).
