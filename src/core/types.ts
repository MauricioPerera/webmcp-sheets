export type NumberFormatType = 'text' | 'number' | 'currency' | 'percent';

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  textColor?: string;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  numberFormat?: NumberFormatType;
  decimals?: number;
}

export interface CellData {
  raw: string;
  computed?: string | number | boolean | null;
  error?: string | null;
  format?: CellFormat;
}

export interface SheetData {
  id: string;
  name: string;
  cells: Record<string, CellData>;
  rowCount: number;
  colCount: number;
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
}

export interface WorkbookData {
  id: string;
  title: string;
  activeSheetId: string;
  sheets: SheetData[];
}

export interface CellCoord {
  col: number;
  row: number;
}

export interface CellRange {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
  sheetName?: string;
}

export interface HistoryRecord {
  workbook: WorkbookData;
  description: string;
}

export interface WebMcpToolMetadata {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  readOnly?: boolean;
}

export interface WebMcpExecutionLog {
  id: string;
  toolName: string;
  args: unknown;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
  timestamp: number;
  durationMs: number;
}
