---
type: 'Architecture'
title: 'Formula Engine Architecture'
description: 'Architecture of the spreadsheet formula lexer, parser, and evaluation engine.'
tags: ['formula', 'engine', 'architecture']
---

# Formula Engine Architecture

The formula engine evaluates spreadsheet formulas client-side without any server dependencies.

## Lifecycle
1. **Lexical Analysis (Tokenizer)**: splits raw formula string into tokens (identifiers, numbers, strings, operators, commas, parentheses).
2. **Parsing (Shunting-Yard / Recursive Descent)**: builds an AST or Reverse Polish Notation (RPN).
3. **Evaluation**: resolves cell and range references against the active workbook and executes built-in spreadsheet functions.

Refer to [formula_ast.md](../data_models/formula_ast.md) and [reactive_dag_arch.md](reactive_dag_arch.md).
