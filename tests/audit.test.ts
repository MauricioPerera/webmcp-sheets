import {it,expect,vi} from 'vitest';
import {CellStore} from '../src/core/cell-store';
import {FormulaEngine} from '../src/core/formula-engine';
import {DependencyGraph} from '../src/core/dependency-graph';
import {ImporterExporter} from '../src/core/importer-exporter';
import {WebMcpService} from '../src/core/webmcp-service';
import {SpreadsheetGrid} from '../src/ui/grid';
function setup(){const s=new CellStore();const e=new FormulaEngine(s);const d=new DependencyGraph(s,e);const io=new ImporterExporter(s);vi.spyOn(console,'warn').mockImplementation(()=>{});return {s,d,io,w:new WebMcpService(s,e,d,io)};}
it('regression: rendered values are escaped',()=>{expect((SpreadsheetGrid.prototype as any).formatDisplayValue('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');});
it('regression: batch write creates one undo entry',async()=>{const {s,w}=setup();await w.executeTool('sheets_set_range',{startCell:'A1',values:[['10']]});expect(s.canUndo()).toBe(true);});
it('regression: batch numeric literals are included in summary',async()=>{const {w}=setup();await w.executeTool('sheets_set_range',{startCell:'A1',values:[['10'],['20']]});expect(await w.executeTool('sheets_get_summary',{})).toMatchObject({sumOfNumericCells:30,numericCellsCount:2});});
it('regression: corrected self-cycle recalculates',async()=>{const {s,w}=setup();await w.executeTool('sheets_set_cell',{cell:'A1',value:'=A1'});await w.executeTool('sheets_set_cell',{cell:'A1',value:'42'});expect(s.getCell('A1')?.computed).toBe(42);});
it('regression: malformed workbook is rejected',()=>{const {s}=setup();expect(s.importJSON('{"sheets":[{}]}')).toBe(false);});
it('regression: malformed persisted workbook is rejected',()=>{const {s}=setup();const data=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{value:{setItem:(k:string,v:string)=>data.set(k,v),getItem:(k:string)=>data.get(k)},configurable:true});data.set('webmcp_sheets_workbook_v1','{"sheets":[{}]}');expect(s.loadFromLocalStorage()).toBe(false);});
