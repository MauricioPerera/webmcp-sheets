import { z } from 'zod';
import {
  registerTool as fastRegisterTool,
  defineDeclarativeTool as fastDefineDeclarativeTool,
  respondToAgentSubmit as fastRespondToAgentSubmit,
} from 'fastwebmcp';
import { CellStore, parseCellRef, parseRange, coordsToRef } from './cell-store';
import { FormulaEngine } from './formula-engine';
import { DependencyGraph } from './dependency-graph';
import { ImporterExporter } from './importer-exporter';
import { WebMcpToolMetadata, WebMcpExecutionLog } from './types';

export interface InternalToolRecord {
  name: string;
  title?: string;
  description: string;
  schema: z.ZodType<any>;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  readOnly: boolean;
  execute: (args: any) => Promise<any>;
}

export class WebMcpService {
  private store: CellStore;
  private engine: FormulaEngine;
  private dag: DependencyGraph;
  private io: ImporterExporter;

  private toolRegistry: Map<string, InternalToolRecord> = new Map();
  private executionLogs: WebMcpExecutionLog[] = [];
  private listeners: Set<(log: WebMcpExecutionLog) => void> = new Set();

  constructor(
    store: CellStore,
    engine: FormulaEngine,
    dag: DependencyGraph,
    io: ImporterExporter
  ) {
    this.store = store;
    this.engine = engine;
    this.dag = dag;
    this.io = io;

    // Ensure modelContext bridge is exposed before registering tools
    this.exposePublicBridge();
    this.registerCoreTools();
  }

  public getRegisteredTools(): WebMcpToolMetadata[] {
    return Array.from(this.toolRegistry.values()).map((t) => ({
      name: t.name,
      title: t.title || t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      outputSchema: t.outputSchema,
      readOnly: t.readOnly,
    }));
  }

  public getExecutionLogs(): WebMcpExecutionLog[] {
    return [...this.executionLogs];
  }

  public onLog(fn: (log: WebMcpExecutionLog) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public async executeTool(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const record = this.toolRegistry.get(toolName);
    if (!record) {
      const err = `Tool "${toolName}" is not registered in WebMCP catalogue`;
      this.logExecution(toolName, args, 'error', undefined, err, 0);
      throw new Error(err);
    }

    const startTime = Date.now();
    try {
      const parsedArgs = record.schema.parse(args);
      const result = await record.execute(parsedArgs);
      const durationMs = Date.now() - startTime;
      this.logExecution(toolName, args, 'success', result, undefined, durationMs);
      return result;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      this.logExecution(toolName, args, 'error', undefined, error.message || String(error), durationMs);
      throw error;
    }
  }

  private logExecution(
    toolName: string,
    args: unknown,
    status: 'success' | 'error',
    result: unknown,
    error: string | undefined,
    durationMs: number
  ): void {
    const log: WebMcpExecutionLog = {
      id: `mcp_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      toolName,
      args,
      status,
      result,
      error,
      timestamp: Date.now(),
      durationMs,
    };
    this.executionLogs.push(log);
    if (this.executionLogs.length > 100) {
      this.executionLogs.shift();
    }
    this.listeners.forEach((fn) => fn(log));
  }

  private registerCoreTools(): void {
    // 1. sheets_get_cell
    this.addTool({
      name: 'sheets_get_cell',
      title: 'Get Cell Data and Format',
      description: 'Get raw value, computed value and format of a specific cell (e.g. A1, B5).',
      schema: z.object({
        cell: z.string().regex(/^([A-Za-z0-9_]+!)?[A-Za-z]+[1-9][0-9]*$/, 'Invalid cell format. Must be in A1 notation (e.g. A1, B2, Sheet1!C3)'),
        sheet: z.string().optional(),
      }),
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          cell: {
            type: 'string',
            pattern: '^([A-Za-z0-9_]+!)?[A-Za-z]+[1-9][0-9]*$',
            description: 'Cell coordinate reference in standard A1 notation, e.g. "A1" or "Sheet1!B2"',
          },
          sheet: {
            type: 'string',
            description: 'Optional sheet tab name (defaults to active sheet)',
          },
        },
        required: ['cell'],
        additionalProperties: false,
      },
      outputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          cell: { type: 'string' },
          sheet: { type: 'string' },
          raw: { type: 'string' },
          value: { type: ['string', 'number', 'boolean', 'null'] },
          error: { type: ['string', 'null'] },
          format: {
            type: 'object',
            properties: {
              bold: { type: 'boolean' },
              italic: { type: 'boolean' },
              textColor: { type: 'string' },
              bgColor: { type: 'string' },
              align: { type: 'string', enum: ['left', 'center', 'right'] },
              numberFormat: { type: 'string', enum: ['text', 'number', 'currency', 'percent'] },
            },
            additionalProperties: false,
          },
        },
        required: ['cell', 'sheet', 'raw', 'value'],
        additionalProperties: false,
      },
      readOnly: true,
      execute: async ({ cell, sheet }) => {
        const parsed = parseCellRef(cell);
        const sheetName = sheet || parsed.sheetName;
        const targetSheet = sheetName ? this.store.getSheetByName(sheetName) : this.store.getActiveSheet();
        if (!targetSheet) throw new Error(`Sheet "${sheetName}" not found`);

        const ref = coordsToRef(parsed.col, parsed.row);
        const data = this.store.getCell(ref, targetSheet.id);
        return {
          cell: ref,
          sheet: targetSheet.name,
          raw: data?.raw || '',
          value: data?.computed !== undefined ? data.computed : data?.raw || '',
          error: data?.error || null,
          format: data?.format || {},
        };
      },
    });

    // 2. sheets_set_cell
    this.addTool({
      name: 'sheets_set_cell',
      title: 'Set Cell Value or Formula',
      description: 'Set raw value or formula for a cell, with optional formatting.',
      schema: z.object({
        cell: z.string().regex(/^([A-Za-z0-9_]+!)?[A-Za-z]+[1-9][0-9]*$/, 'Invalid cell format. Must be in A1 notation (e.g. A1, B2)'),
        value: z.string().describe('Value or formula starting with "="'),
        sheet: z.string().optional(),
        format: z
          .object({
            bold: z.boolean().optional(),
            italic: z.boolean().optional(),
            textColor: z.string().optional(),
            bgColor: z.string().optional(),
            align: z.enum(['left', 'center', 'right']).optional(),
            numberFormat: z.enum(['text', 'number', 'currency', 'percent']).optional(),
          })
          .optional(),
      }),
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          cell: {
            type: 'string',
            pattern: '^([A-Za-z0-9_]+!)?[A-Za-z]+[1-9][0-9]*$',
            description: 'Target cell coordinate in standard A1 notation, e.g. "A1"',
          },
          value: {
            type: 'string',
            description: 'String literal, numeric value, or formula starting with "=" (e.g. "=SUM(A1:A10)")',
          },
          sheet: {
            type: 'string',
            description: 'Optional worksheet tab name (defaults to active sheet)',
          },
          format: {
            type: 'object',
            properties: {
              bold: { type: 'boolean' },
              italic: { type: 'boolean' },
              textColor: { type: 'string' },
              bgColor: { type: 'string' },
              align: { type: 'string', enum: ['left', 'center', 'right'] },
              numberFormat: { type: 'string', enum: ['text', 'number', 'currency', 'percent'] },
            },
            additionalProperties: false,
          },
        },
        required: ['cell', 'value'],
        additionalProperties: false,
      },
      outputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          cell: { type: 'string' },
          value: { type: ['string', 'number', 'boolean', 'null'] },
        },
        required: ['success', 'cell'],
      },
      readOnly: false,
      execute: async ({ cell, value, sheet, format }) => {
        const parsed = parseCellRef(cell);
        const sheetName = sheet || parsed.sheetName;
        const targetSheet = sheetName ? this.store.getSheetByName(sheetName) : this.store.getActiveSheet();
        if (!targetSheet) throw new Error(`Sheet "${sheetName}" not found`);

        const ref = coordsToRef(parsed.col, parsed.row);
        this.store.setCell(ref, { raw: value, format: format as any }, targetSheet.id);
        const { hasCycle } = this.dag.updateCellDependencies(ref, value, targetSheet.id);
        if (!hasCycle) {
          this.dag.recalculate(ref, targetSheet.id);
        }

        const updated = this.store.getCell(ref, targetSheet.id);
        return {
          success: true,
          cell: ref,
          value: updated?.computed !== undefined ? updated.computed : updated?.raw,
        };
      },
    });

    // 3. sheets_get_range
    this.addTool({
      name: 'sheets_get_range',
      title: 'Get 2D Range Data',
      description: 'Get values and formulas for a rectangular range of cells (e.g. "A1:C5").',
      schema: z.object({
        range: z.string().regex(/^([A-Za-z0-9_]+!)?[A-Za-z]+[1-9][0-9]*:[A-Za-z]+[1-9][0-9]*$/, 'Invalid range format. Must be A1:B10 format'),
        sheet: z.string().optional(),
      }),
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          range: {
            type: 'string',
            pattern: '^([A-Za-z0-9_]+!)?[A-Za-z]+[1-9][0-9]*:[A-Za-z]+[1-9][0-9]*$',
            description: 'Rectangular 2D range reference in A1:B10 format, e.g. "A1:B5"',
          },
          sheet: {
            type: 'string',
            description: 'Optional sheet tab name',
          },
        },
        required: ['range'],
        additionalProperties: false,
      },
      outputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          range: { type: 'string' },
          sheet: { type: 'string' },
          matrix: {
            type: 'array',
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ref: { type: 'string' },
                  raw: { type: 'string' },
                  value: { type: ['string', 'number', 'boolean', 'null'] },
                },
                required: ['ref', 'raw', 'value'],
                additionalProperties: false,
              },
            },
            description: '2D array of rows containing cells with ref, raw, and computed values',
          },
        },
        required: ['range', 'sheet', 'matrix'],
        additionalProperties: false,
      },
      readOnly: true,
      execute: async ({ range, sheet }) => {
        const parsedRange = parseRange(range);
        const sheetName = sheet || parsedRange.sheetName;
        const targetSheet = sheetName ? this.store.getSheetByName(sheetName) : this.store.getActiveSheet();
        if (!targetSheet) throw new Error(`Sheet "${sheetName}" not found`);

        const rows: any[][] = [];
        for (let r = parsedRange.startRow; r <= parsedRange.endRow; r++) {
          const rowVals: any[] = [];
          for (let c = parsedRange.startCol; c <= parsedRange.endCol; c++) {
            const ref = coordsToRef(c, r);
            const cell = targetSheet.cells[ref];
            rowVals.push({
              ref,
              raw: cell?.raw || '',
              value: cell?.computed !== undefined ? cell.computed : cell?.raw || '',
            });
          }
          rows.push(rowVals);
        }
        return { range, sheet: targetSheet.name, matrix: rows };
      },
    });

    // 4. sheets_set_range
    this.addTool({
      name: 'sheets_set_range',
      title: 'Batch Set Range Matrix',
      description: 'Batch set a 2D matrix of values or formulas into a range starting at given coordinate.',
      schema: z.object({
        startCell: z.string().regex(/^([A-Za-z0-9_]+!)?[A-Za-z]+[1-9][0-9]*$/, 'Invalid startCell format. Must be A1 format'),
        values: z.array(z.array(z.string())),
        sheet: z.string().optional(),
      }),
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          startCell: {
            type: 'string',
            pattern: '^([A-Za-z0-9_]+!)?[A-Za-z]+[1-9][0-9]*$',
            description: 'Top-left starting cell coordinate, e.g. "A1"',
          },
          values: {
            type: 'array',
            items: { type: 'array', items: { type: 'string' } },
            description: '2D array of strings representing table rows and columns',
          },
          sheet: {
            type: 'string',
            description: 'Optional worksheet tab name',
          },
        },
        required: ['startCell', 'values'],
        additionalProperties: false,
      },
      outputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          rowsUpdated: { type: 'number' },
        },
        required: ['success', 'rowsUpdated'],
      },
      readOnly: false,
      execute: async ({ startCell, values, sheet }) => {
        const start = parseCellRef(startCell);
        const sheetName = sheet || start.sheetName;
        const targetSheet = sheetName ? this.store.getSheetByName(sheetName) : this.store.getActiveSheet();
        if (!targetSheet) throw new Error(`Sheet "${sheetName}" not found`);

        for (let r = 0; r < values.length; r++) {
          const row = values[r];
          for (let c = 0; c < row.length; c++) {
            const ref = coordsToRef(start.col + c, start.row + r);
            const val = row[c];
            this.store.setCellRaw(ref, val, targetSheet.id, false);
            this.dag.updateCellDependencies(ref, val, targetSheet.id);
          }
        }
        this.dag.recalculateAll();
        return { success: true, rowsUpdated: values.length };
      },
    });

    // 5. sheets_evaluate_formula
    this.addTool({
      name: 'sheets_evaluate_formula',
      title: 'Evaluate Expression On the Fly',
      description: 'Evaluate an arbitrary formula expression on the fly (e.g. "=SUM(10, 20, 30)").',
      schema: z.object({
        formula: z.string().regex(/^=.*$/, 'Formula expression must begin with "="'),
        sheet: z.string().optional(),
      }),
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          formula: {
            type: 'string',
            pattern: '^=.*$',
            description: 'Spreadsheet formula expression starting with "=" (e.g. "=SUM(10, 20, 30)")',
          },
          sheet: {
            type: 'string',
            description: 'Optional worksheet evaluation context',
          },
        },
        required: ['formula'],
        additionalProperties: false,
      },
      outputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          formula: { type: 'string' },
          result: { type: ['string', 'number', 'boolean', 'null'] },
          error: { type: ['string', 'null'] },
        },
        required: ['formula'],
      },
      readOnly: true,
      execute: async ({ formula, sheet }) => {
        const targetSheet = sheet ? this.store.getSheetByName(sheet) : this.store.getActiveSheet();
        const res = this.engine.evaluate(formula, targetSheet?.id);
        return { formula, result: res.value, error: res.error || null };
      },
    });

    // 6. sheets_clear_range
    this.addTool({
      name: 'sheets_clear_range',
      title: 'Clear Cell Range',
      description: 'Clear values and formatting in a specified rectangular range.',
      schema: z.object({
        range: z.string().regex(/^([A-Za-z0-9_]+!)?[A-Za-z]+[1-9][0-9]*:[A-Za-z]+[1-9][0-9]*$/, 'Invalid range format. Must be A1:B10 format'),
        sheet: z.string().optional(),
      }),
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          range: {
            type: 'string',
            pattern: '^([A-Za-z0-9_]+!)?[A-Za-z]+[1-9][0-9]*:[A-Za-z]+[1-9][0-9]*$',
            description: 'Range reference in A1:B10 notation, e.g. "A1:C10"',
          },
          sheet: {
            type: 'string',
            description: 'Optional sheet tab name',
          },
        },
        required: ['range'],
        additionalProperties: false,
      },
      outputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          clearedRange: { type: 'string' },
        },
        required: ['success', 'clearedRange'],
      },
      readOnly: false,
      execute: async ({ range, sheet }) => {
        const parsed = parseRange(range);
        const targetSheet = sheet ? this.store.getSheetByName(sheet) : this.store.getActiveSheet();
        this.store.clearRange(parsed, targetSheet?.id);
        this.dag.recalculateAll();
        return { success: true, clearedRange: range };
      },
    });

    // 7. sheets_create_sheet
    this.addTool({
      name: 'sheets_create_sheet',
      title: 'Create New Worksheet',
      description: 'Add a new sheet tab to the workbook with the given name.',
      schema: z.object({
        name: z.string().min(1).describe('Name for the new sheet'),
      }),
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Unique name for the new worksheet tab',
          },
        },
        required: ['name'],
        additionalProperties: false,
      },
      outputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          sheetId: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['success', 'sheetId', 'name'],
      },
      readOnly: false,
      execute: async ({ name }) => {
        const newSheet = this.store.addSheet(name);
        return { success: true, sheetId: newSheet.id, name: newSheet.name };
      },
    });

    // 8. sheets_delete_sheet
    this.addTool({
      name: 'sheets_delete_sheet',
      title: 'Delete Worksheet',
      description: 'Delete a sheet tab from the workbook by name.',
      schema: z.object({
        name: z.string().describe('Name of the sheet to delete'),
      }),
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the sheet tab to delete',
          },
        },
        required: ['name'],
        additionalProperties: false,
      },
      outputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          deleted: { type: 'string' },
        },
        required: ['success', 'deleted'],
      },
      readOnly: false,
      execute: async ({ name }) => {
        const sheet = this.store.getSheetByName(name);
        if (!sheet) throw new Error(`Sheet "${name}" not found`);
        const ok = this.store.deleteSheet(sheet.id);
        if (!ok) throw new Error('Cannot delete the only sheet in the workbook');
        return { success: true, deleted: name };
      },
    });

    // 9. sheets_list_sheets
    this.addTool({
      name: 'sheets_list_sheets',
      title: 'List All Worksheets',
      description: 'List all sheets in the current workbook and report the active sheet.',
      schema: z.object({}),
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      outputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          activeSheet: { type: 'string' },
          sheets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                cellCount: { type: 'number' },
              },
              required: ['id', 'name', 'cellCount'],
              additionalProperties: false,
            },
            description: 'List of worksheets with ID, name, and cell count',
          },
        },
        required: ['activeSheet', 'sheets'],
        additionalProperties: false,
      },
      readOnly: true,
      execute: async () => {
        const active = this.store.getActiveSheet();
        return {
          activeSheet: active.name,
          sheets: this.store.getSheets().map((s) => ({
            id: s.id,
            name: s.name,
            cellCount: Object.keys(s.cells).length,
          })),
        };
      },
    });

    // 10. sheets_find_replace
    this.addTool({
      name: 'sheets_find_replace',
      title: 'Find and Replace in Cells',
      description: 'Find and replace text or formula substrings across cells.',
      schema: z.object({
        find: z.string().min(1).describe('String to search for'),
        replace: z.string().describe('Replacement string'),
        sheet: z.string().optional().describe('Optional sheet name'),
        matchCase: z.boolean().optional().describe('Match case sensitive (default false)'),
      }),
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          find: {
            type: 'string',
            description: 'String or substring to search for',
          },
          replace: {
            type: 'string',
            description: 'Replacement string to substitute',
          },
          sheet: {
            type: 'string',
            description: 'Optional sheet tab name',
          },
          matchCase: {
            type: 'boolean',
            description: 'Case sensitive matching (default false)',
          },
        },
        required: ['find', 'replace'],
        additionalProperties: false,
      },
      outputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          replacementsCount: { type: 'number' },
        },
        required: ['success', 'replacementsCount'],
      },
      readOnly: false,
      execute: async ({ find, replace, sheet, matchCase }) => {
        const targetSheet = sheet ? this.store.getSheetByName(sheet) : this.store.getActiveSheet();
        if (!targetSheet) throw new Error('Sheet not found');

        let replacements = 0;
        for (const [ref, cell] of Object.entries(targetSheet.cells)) {
          const raw = cell.raw;
          const needle = matchCase ? find : find.toLowerCase();
          const haystack = matchCase ? raw : raw.toLowerCase();

          if (haystack.includes(needle)) {
            const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
            const updated = raw.replace(regex, replace);
            this.store.setCellRaw(ref, updated, targetSheet.id, false);
            this.dag.updateCellDependencies(ref, updated, targetSheet.id);
            replacements++;
          }
        }
        if (replacements > 0) {
          this.dag.recalculateAll();
        }
        return { success: true, replacementsCount: replacements };
      },
    });

    // 11. sheets_export_data
    this.addTool({
      name: 'sheets_export_data',
      title: 'Export Sheet Data',
      description: 'Export spreadsheet data in CSV or JSON format.',
      schema: z.object({
        format: z.enum(['csv', 'json']).describe('Export format'),
        sheet: z.string().optional().describe('Optional sheet name for CSV export'),
      }),
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['csv', 'json'],
            description: 'Export serialization format',
          },
          sheet: {
            type: 'string',
            description: 'Optional sheet tab name for CSV export',
          },
        },
        required: ['format'],
        additionalProperties: false,
      },
      outputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          format: { type: 'string' },
          data: { type: 'string' },
        },
        required: ['format', 'data'],
      },
      readOnly: true,
      execute: async ({ format, sheet }) => {
        if (format === 'json') {
          return { format: 'json', data: this.store.exportJSON() };
        } else {
          const targetSheet = sheet ? this.store.getSheetByName(sheet) : this.store.getActiveSheet();
          return { format: 'csv', data: this.io.exportCSV(targetSheet?.id) };
        }
      },
    });

    // 12. sheets_get_summary
    this.addTool({
      name: 'sheets_get_summary',
      title: 'Get Workbook and Sheet Summary',
      description: 'Get an analytical summary of non-empty cells, columns, and numeric totals.',
      schema: z.object({
        sheet: z.string().optional().describe('Optional sheet name'),
      }),
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          sheet: {
            type: 'string',
            description: 'Optional worksheet tab name',
          },
        },
        additionalProperties: false,
      },
      outputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          title: { type: 'string' },
          sheet: { type: 'string' },
          populatedCells: { type: 'number' },
          numericCellsCount: { type: 'number' },
          sumOfNumericCells: { type: 'number' },
          averageOfNumericCells: { type: 'number' },
        },
        required: ['title', 'sheet', 'populatedCells', 'numericCellsCount', 'sumOfNumericCells', 'averageOfNumericCells'],
      },
      readOnly: true,
      execute: async ({ sheet }) => {
        const targetSheet = sheet ? this.store.getSheetByName(sheet) : this.store.getActiveSheet();
        if (!targetSheet) throw new Error('Sheet not found');

        const populatedCells = Object.keys(targetSheet.cells).length;
        let sum = 0;
        let numCount = 0;

        for (const cell of Object.values(targetSheet.cells)) {
          if (typeof cell.computed === 'number') {
            sum += cell.computed;
            numCount++;
          }
        }

        return {
          title: this.store.getTitle(),
          sheet: targetSheet.name,
          populatedCells,
          numericCellsCount: numCount,
          sumOfNumericCells: sum,
          averageOfNumericCells: numCount > 0 ? sum / numCount : 0,
        };
      },
    });

  }

  private addTool(record: InternalToolRecord): void {
    this.toolRegistry.set(record.name, record);

    const fullSpecTool = {
      name: record.name,
      title: record.title || record.name,
      description: record.description,
      inputSchema: record.inputSchema,
      outputSchema: record.outputSchema,
      annotations: {
        readOnlyHint: record.readOnly,
      },
      execute: record.execute,
    };

    // Register on document.modelContext
    try {
      if (typeof document !== 'undefined') {
        const docCtx = (document as any).modelContext;
        if (docCtx && typeof docCtx.registerTool === 'function') {
          docCtx.registerTool(fullSpecTool);
        }
      }
    } catch {
      // safe fallback
    }

    // Register on navigator.modelContext
    try {
      if (typeof navigator !== 'undefined') {
        const navCtx = (navigator as any).modelContext;
        if (navCtx && typeof navCtx.registerTool === 'function') {
          navCtx.registerTool(fullSpecTool);
        }
      }
    } catch {
      // safe fallback
    }

    // Register with fastwebmcp
    try {
      const schemaWrapper = {
        parse: (rawInput: any) => record.schema.parse(rawInput),
        toJSONSchema: () => record.inputSchema,
        _def: {},
      };
      fastRegisterTool({
        name: record.name,
        description: record.description,
        inputSchema: schemaWrapper as any,
        annotations: { readOnlyHint: record.readOnly },
        execute: record.execute,
      });
    } catch {
      // safe fallback
    }
  }

  public defineDeclarativeTool(form: HTMLFormElement, spec: any): void {
    try {
      fastDefineDeclarativeTool(form, spec);
    } catch (e) {
      console.warn('Declarative tool definition warning:', e);
    }
  }

  public respondToAgentSubmit(event: Event, handler: (e: any) => any): void {
    try {
      fastRespondToAgentSubmit(event as any, handler as any);
    } catch (e) {
      console.warn('Declarative submit response warning:', e);
    }
  }

  private exposePublicBridge(): void {
    if (typeof window === 'undefined') return;

    const globalAny = window as any;
    globalAny.WebMCP = {
      getTools: () => this.getRegisteredTools(),
      execute: (name: string, args?: Record<string, unknown>) => this.executeTool(name, args),
      getLogs: () => this.getExecutionLogs(),
    };

    const registeredMap = new Map<string, any>();

    const createModelContext = () => ({
      registerTool: (tool: any) => {
        registeredMap.set(tool.name, tool);
      },
      listTools: () => {
        if (registeredMap.size > 0) {
          return Array.from(registeredMap.values());
        }
        return this.getRegisteredTools();
      },
      callTool: (name: string, args: any) => this.executeTool(name, args),
      hasTool: (name: string) => this.toolRegistry.has(name) || registeredMap.has(name),
    });

    if (typeof document !== 'undefined') {
      const docAny = document as any;
      if (!docAny.modelContext || typeof docAny.modelContext.registerTool !== 'function') {
        docAny.modelContext = createModelContext();
      }
    }

    if (typeof navigator !== 'undefined') {
      const navAny = navigator as any;
      if (!navAny.modelContext || typeof navAny.modelContext.registerTool !== 'function') {
        try {
          Object.defineProperty(navigator, 'modelContext', {
            value: (document as any).modelContext || createModelContext(),
            writable: true,
            configurable: true,
          });
        } catch {
          navAny.modelContext = (document as any).modelContext || createModelContext();
        }
      }
    }
  }
}
