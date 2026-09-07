---
type: 'Data Model'
title: 'Workbook Data Model'
description: 'Data model representing multi-sheet workbooks, sheet metadata and state.'
tags: ['spreadsheet', 'workbook', 'sheet', 'data-model']
---

# Workbook Data Model

The Workbook is the top-level container of the spreadsheet, containing multiple sheets and tracking the active sheet.

## Structure
```typescript
export interface SheetData {
  id: string;
  name: string;
  cells: Record<string, CellData>;
  rowCount: number;
  colCount: number;
}

export interface WorkbookData {
  id: string;
  title: string;
  activeSheetId: string;
  sheets: SheetData[];
}
```

See [cell_model.md](cell_model.md) for individual cell structure.
