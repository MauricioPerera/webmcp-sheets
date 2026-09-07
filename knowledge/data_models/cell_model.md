---
type: 'Data Model'
title: 'Cell Data Model'
description: 'Data model representing a spreadsheet cell, coordinate systems, values and formatting.'
tags: ['spreadsheet', 'cell', 'data-model']
---

# Cell Data Model

A Cell represents a single coordinate within a Sheet grid.

## Coordinate Format
- Column: 0-indexed integer `col` mapped to letters `A..Z`, `AA..ZZ`.
- Row: 0-indexed integer `row` mapped to 1-indexed numbers `1..N`.
- Reference: `A1`, `B2`, `$C$4`.

## Cell Structure
```typescript
export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  textColor?: string;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  numberFormat?: 'text' | 'number' | 'currency' | 'percent';
  decimals?: number;
}

export interface CellData {
  raw: string;
  computed?: string | number | boolean | null;
  error?: string | null;
  format?: CellFormat;
}
```

See related [workbook_model.md](workbook_model.md) and [formula_ast.md](formula_ast.md).
