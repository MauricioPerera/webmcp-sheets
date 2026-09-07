---
type: 'Task Contract'
title: 'Implement Formula Engine'
description: 'Spreadsheet formula tokenizer, expression parser, and evaluation engine supporting 30+ functions.'
tags: ['ccdd', 'formula', 'engine', 'parser']
task: formula_engine
intent: 'Implement client-side formula evaluation for mathematical, logical, text, lookup, and date expressions.'
target: src/core/formula-engine.ts
signature: 'export class FormulaEngine'
test_command: 'npm test -- tests/formula-engine.test.ts'
budget:
  cyclomatic_max: 35
  nesting_max: 6
  lines_max: 900
tests: tests/formula-engine.test.ts
tests_sha256: d9969aeecd83ed0712d1959e34e0bf2bd894cee175e1334755f82faf47a12b21
deps_allowed: []
touch_only: ['src/core/formula-engine.ts']
forbids: ['eval', 'Function', 'child_process']
---

# Task Contract: Formula Engine

## Intent
Evaluate formulas client-side without any server dependencies as specified in [formula_engine_arch.md](../architecture/formula_engine_arch.md) and [formula_ast.md](../data_models/formula_ast.md).

## Interface
```typescript
export class FormulaEngine {
  evaluate(raw: string, currentSheetId?: string): { value: EvalResult; error?: string | null };
  extractDependencies(formula: string, currentSheetName?: string): string[];
}
```

## Invariants
- Formulas starting with `=` must evaluate arithmetic, logical, and built-in function expressions.
- Division by zero must yield `#DIV/0!`.
- Unknown identifiers must yield `#NAME?`.

## Examples
- `=SUM(10, 20, 30)` evaluates to `60`.
- `=IF(10 > 5, "High", "Low")` evaluates to `"High"`.

## Do / Don't
- **DO:** Return standard spreadsheet error codes (`#DIV/0!`, `#VALUE!`, `#REF!`, `#NAME?`, `#N/A`).
- **DON'T:** Use JavaScript `eval()` or unsanitized function constructors.

## Tests
Verified by frozen oracle test suite `tests/formula-engine.test.ts`.

## Constraints
PARAR y reportar si se detecta inyección de código arbitrario o sintaxis no reconocible que pueda causar bucles infinitos en el evaluador.
