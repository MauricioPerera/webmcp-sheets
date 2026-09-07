import { CellStore, parseCellRef, parseRange, getCellsInRange, coordsToRef } from './cell-store';

export type EvalResult = string | number | boolean | null;

interface Token {
  type: 'NUMBER' | 'STRING' | 'BOOLEAN' | 'IDENT' | 'CELL' | 'RANGE' | 'OP' | 'COMMA' | 'LPAREN' | 'RPAREN';
  value: string;
}

export class FormulaEngine {
  private store: CellStore;

  constructor(store: CellStore) {
    this.store = store;
  }

  /**
   * Evaluates a raw cell value. If it begins with '=', evaluates formula; otherwise parses number/bool/string.
   */
  public evaluate(raw: string, currentSheetId?: string): { value: EvalResult; error?: string | null } {
    if (!raw) {
      return { value: '' };
    }

    const trimmed = raw.trim();
    if (!trimmed.startsWith('=')) {
      // Not a formula
      if (!isNaN(Number(trimmed)) && trimmed !== '') {
        return { value: Number(trimmed) };
      }
      if (trimmed.toUpperCase() === 'TRUE') return { value: true };
      if (trimmed.toUpperCase() === 'FALSE') return { value: false };
      return { value: raw };
    }

    // It's a formula
    const formulaStr = trimmed.substring(1).trim();
    try {
      const tokens = this.tokenize(formulaStr);
      if (tokens.length === 0) {
        return { value: '' };
      }
      const result = this.parseAndEvalExpression(tokens, currentSheetId);
      return { value: result };
    } catch (e: any) {
      const err = e.message?.startsWith('#') ? e.message : '#ERROR!';
      return { value: err, error: err };
    }
  }

  /**
   * Extracts all cell references and ranges that a formula depends on.
   */
  public extractDependencies(formula: string, currentSheetName?: string): string[] {
    if (!formula.trim().startsWith('=')) return [];

    const deps = new Set<string>();
    try {
      const tokens = this.tokenize(formula.trim().substring(1));
      for (const token of tokens) {
        if (token.type === 'CELL') {
          const parsed = parseCellRef(token.value);
          const sheet = parsed.sheetName || currentSheetName;
          const ref = coordsToRef(parsed.col, parsed.row);
          deps.add(sheet ? `${sheet}!${ref}` : ref);
        } else if (token.type === 'RANGE') {
          const range = parseRange(token.value);
          const sheet = range.sheetName || currentSheetName;
          const cells = getCellsInRange(range);
          for (const c of cells) {
            deps.add(sheet ? `${sheet}!${c}` : c);
          }
        }
      }
    } catch {
      // Ignore tokenization errors during dependency scan
    }
    return Array.from(deps);
  }

  /**
   * Tokenizer for Excel / Sheets style formulas
   */
  public tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const len = expr.length;

    while (i < len) {
      const ch = expr[i];

      // Whitespace
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // String literal "hello"
      if (ch === '"' || ch === "'") {
        const quote = ch;
        i++;
        let str = '';
        while (i < len && expr[i] !== quote) {
          str += expr[i];
          i++;
        }
        if (i < len) i++; // consume quote
        tokens.push({ type: 'STRING', value: str });
        continue;
      }

      // Parentheses & Comma
      if (ch === '(') {
        tokens.push({ type: 'LPAREN', value: '(' });
        i++;
        continue;
      }
      if (ch === ')') {
        tokens.push({ type: 'RPAREN', value: ')' });
        i++;
        continue;
      }
      if (ch === ',') {
        tokens.push({ type: 'COMMA', value: ',' });
        i++;
        continue;
      }

      // Operators
      if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '&' || ch === '%') {
        tokens.push({ type: 'OP', value: ch });
        i++;
        continue;
      }
      if (ch === '=' || ch === '<' || ch === '>') {
        let op = ch;
        if (i + 1 < len) {
          const next = expr[i + 1];
          if ((ch === '<' && (next === '>' || next === '=')) || (ch === '>' && next === '=')) {
            op += next;
            i++;
          }
        }
        tokens.push({ type: 'OP', value: op });
        i++;
        continue;
      }

      // Numbers
      if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(expr[i + 1]))) {
        let numStr = '';
        while (i < len && /[0-9.]/.test(expr[i])) {
          numStr += expr[i];
          i++;
        }
        tokens.push({ type: 'NUMBER', value: numStr });
        continue;
      }

      // Identifiers, Cell Refs, Ranges, Function names (e.g. SUM, A1, A1:B10, Sheet1!A1)
      if (/[A-Za-z_$]/.test(ch)) {
        let idStr = '';
        while (
          i < len &&
          (/[A-Za-z0-9_$.!]/.test(expr[i]) || expr[i] === ':')
        ) {
          idStr += expr[i];
          i++;
        }

        const upper = idStr.toUpperCase();
        if (upper === 'TRUE' || upper === 'FALSE') {
          tokens.push({ type: 'BOOLEAN', value: upper });
        } else if (idStr.includes(':')) {
          tokens.push({ type: 'RANGE', value: idStr });
        } else if (this.isCellRef(idStr)) {
          tokens.push({ type: 'CELL', value: idStr });
        } else {
          tokens.push({ type: 'IDENT', value: upper });
        }
        continue;
      }

      // Unknown character
      i++;
    }

    return tokens;
  }

  private isCellRef(str: string): boolean {
    const clean = str.replace(/.*!/, '').replace(/\$/g, '');
    return /^[A-Za-z]+[0-9]+$/.test(clean);
  }

  /**
   * Pratt / Recursive Descent expression evaluator
   */
  private parseAndEvalExpression(tokens: Token[], currentSheetId?: string): EvalResult {
    let pos = 0;

    const peek = (): Token | undefined => tokens[pos];
    const consume = (): Token => tokens[pos++];

    const parseExpression = (minPrecedence = 0): EvalResult => {
      let left = parsePrimary();

      while (pos < tokens.length) {
        const token = peek();
        if (!token || token.type !== 'OP') break;

        const precedence = this.getOperatorPrecedence(token.value);
        if (precedence < minPrecedence) break;

        const opToken = consume();
        const nextMinPrec = this.isRightAssociative(opToken.value) ? precedence : precedence + 1;
        const right = parseExpression(nextMinPrec);

        left = this.applyBinaryOp(opToken.value, left, right);
      }

      return left;
    };

    const parsePrimary = (): EvalResult => {
      const token = peek();
      if (!token) throw new Error('#ERROR!');

      // Unary +/-
      if (token.type === 'OP' && (token.value === '+' || token.value === '-')) {
        consume();
        const val = parsePrimary();
        const num = Number(val);
        if (isNaN(num)) throw new Error('#VALUE!');
        return token.value === '-' ? -num : num;
      }

      // Grouping ( ... )
      if (token.type === 'LPAREN') {
        consume(); // (
        const val = parseExpression(0);
        if (!peek() || peek()?.type !== 'RPAREN') {
          throw new Error('#ERROR!');
        }
        consume(); // )
        return val;
      }

      // Number literal
      if (token.type === 'NUMBER') {
        consume();
        return Number(token.value);
      }

      // String literal
      if (token.type === 'STRING') {
        consume();
        return token.value;
      }

      // Boolean literal
      if (token.type === 'BOOLEAN') {
        consume();
        return token.value === 'TRUE';
      }

      // Single Cell Reference
      if (token.type === 'CELL') {
        consume();
        return this.resolveCellValue(token.value, currentSheetId);
      }

      // Function call e.g. SUM(...)
      if (token.type === 'IDENT') {
        const fnName = consume().value;
        if (!peek() || peek()?.type !== 'LPAREN') {
          throw new Error('#NAME?');
        }
        consume(); // (

        // Collect argument expressions or ranges
        const args: any[] = [];
        if (peek() && peek()?.type !== 'RPAREN') {
          while (true) {
            // Check if argument is a RANGE token
            if (peek()?.type === 'RANGE') {
              const rangeToken = consume();
              args.push({ isRange: true, value: rangeToken.value });
            } else {
              args.push(parseExpression(0));
            }

            if (peek() && peek()?.type === 'COMMA') {
              consume(); // ,
            } else {
              break;
            }
          }
        }

        if (!peek() || peek()?.type !== 'RPAREN') {
          throw new Error('#ERROR!');
        }
        consume(); // )

        return this.executeFunction(fnName, args, currentSheetId);
      }

      throw new Error('#ERROR!');
    };

    return parseExpression(0);
  }

  private getOperatorPrecedence(op: string): number {
    switch (op) {
      case '=':
      case '<>':
      case '<':
      case '>':
      case '<=':
      case '>=':
        return 1;
      case '&':
        return 2;
      case '+':
      case '-':
        return 3;
      case '*':
      case '/':
      case '%':
        return 4;
      case '^':
        return 5;
      default:
        return 0;
    }
  }

  private isRightAssociative(op: string): boolean {
    return op === '^';
  }

  private applyBinaryOp(op: string, left: EvalResult, right: EvalResult): EvalResult {
    // String concatenation
    if (op === '&') {
      return String(left ?? '') + String(right ?? '');
    }

    // Comparisons
    if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
      if (op === '=') return left == right;
      if (op === '<>') return left != right;

      const numL = Number(left);
      const numR = Number(right);
      if (!isNaN(numL) && !isNaN(numR)) {
        if (op === '<') return numL < numR;
        if (op === '>') return numL > numR;
        if (op === '<=') return numL <= numR;
        if (op === '>=') return numL >= numR;
      }
      // String comparison
      const strL = String(left ?? '');
      const strR = String(right ?? '');
      if (op === '<') return strL < strR;
      if (op === '>') return strL > strR;
      if (op === '<=') return strL <= strR;
      if (op === '>=') return strL >= strR;
    }

    // Arithmetic
    const numL = Number(left ?? 0);
    const numR = Number(right ?? 0);
    if (isNaN(numL) || isNaN(numR)) {
      throw new Error('#VALUE!');
    }

    switch (op) {
      case '+':
        return numL + numR;
      case '-':
        return numL - numR;
      case '*':
        return numL * numR;
      case '/':
        if (numR === 0) throw new Error('#DIV/0!');
        return numL / numR;
      case '%':
        return numL % numR;
      case '^':
        return Math.pow(numL, numR);
      default:
        throw new Error('#ERROR!');
    }
  }

  private resolveCellValue(refStr: string, currentSheetId?: string): EvalResult {
    const parsed = parseCellRef(refStr);
    let targetSheetId = currentSheetId;

    if (parsed.sheetName) {
      const sheet = this.store.getSheetByName(parsed.sheetName);
      if (!sheet) throw new Error('#REF!');
      targetSheetId = sheet.id;
    }

    const cellRef = coordsToRef(parsed.col, parsed.row);
    const cell = this.store.getCell(cellRef, targetSheetId);
    if (!cell) return '';

    if (cell.error) throw new Error(cell.error);
    if (cell.computed !== undefined && cell.computed !== null) {
      return cell.computed;
    }

    if (cell.raw.startsWith('=')) {
      // Evaluate recursively
      const res = this.evaluate(cell.raw, targetSheetId);
      if (res.error) throw new Error(res.error);
      return res.value;
    }

    if (!isNaN(Number(cell.raw)) && cell.raw.trim() !== '') {
      return Number(cell.raw);
    }
    return cell.raw;
  }

  private expandRangeValues(rangeArg: { isRange: true; value: string }, currentSheetId?: string): EvalResult[] {
    const range = parseRange(rangeArg.value);
    let targetSheetId = currentSheetId;

    if (range.sheetName) {
      const sheet = this.store.getSheetByName(range.sheetName);
      if (!sheet) throw new Error('#REF!');
      targetSheetId = sheet.id;
    }

    const refs = getCellsInRange(range);
    const values: EvalResult[] = [];

    for (const ref of refs) {
      const cell = this.store.getCell(ref, targetSheetId);
      if (!cell || cell.raw === '') {
        values.push(null);
      } else if (cell.computed !== undefined && cell.computed !== null) {
        values.push(cell.computed);
      } else if (!isNaN(Number(cell.raw)) && cell.raw.trim() !== '') {
        values.push(Number(cell.raw));
      } else {
        values.push(cell.raw);
      }
    }
    return values;
  }

  private flattenNumbers(args: any[], currentSheetId?: string): number[] {
    const numbers: number[] = [];
    for (const arg of args) {
      if (arg && arg.isRange) {
        const vals = this.expandRangeValues(arg, currentSheetId);
        for (const v of vals) {
          if (typeof v === 'number') numbers.push(v);
          else if (typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== '') {
            numbers.push(Number(v));
          }
        }
      } else if (typeof arg === 'number') {
        numbers.push(arg);
      } else if (typeof arg === 'string' && !isNaN(Number(arg)) && arg.trim() !== '') {
        numbers.push(Number(arg));
      }
    }
    return numbers;
  }

  private flattenAll(args: any[], currentSheetId?: string): EvalResult[] {
    const all: EvalResult[] = [];
    for (const arg of args) {
      if (arg && arg.isRange) {
        all.push(...this.expandRangeValues(arg, currentSheetId));
      } else {
        all.push(arg);
      }
    }
    return all;
  }

  /**
   * Executes built-in spreadsheet functions
   */
  public executeFunction(name: string, args: any[], currentSheetId?: string): EvalResult {
    const fn = name.toUpperCase();

    switch (fn) {
      // Math & Stats
      case 'SUM': {
        const nums = this.flattenNumbers(args, currentSheetId);
        return nums.reduce((acc, cur) => acc + cur, 0);
      }
      case 'AVERAGE': {
        const nums = this.flattenNumbers(args, currentSheetId);
        if (nums.length === 0) throw new Error('#DIV/0!');
        return nums.reduce((acc, cur) => acc + cur, 0) / nums.length;
      }
      case 'MIN': {
        const nums = this.flattenNumbers(args, currentSheetId);
        if (nums.length === 0) return 0;
        return Math.min(...nums);
      }
      case 'MAX': {
        const nums = this.flattenNumbers(args, currentSheetId);
        if (nums.length === 0) return 0;
        return Math.max(...nums);
      }
      case 'COUNT': {
        const nums = this.flattenNumbers(args, currentSheetId);
        return nums.length;
      }
      case 'COUNTA': {
        const all = this.flattenAll(args, currentSheetId);
        return all.filter((x) => x !== null && x !== '').length;
      }
      case 'COUNTBLANK': {
        const all = this.flattenAll(args, currentSheetId);
        return all.filter((x) => x === null || x === '').length;
      }
      case 'PRODUCT': {
        const nums = this.flattenNumbers(args, currentSheetId);
        if (nums.length === 0) return 0;
        return nums.reduce((acc, cur) => acc * cur, 1);
      }
      case 'ABS': {
        const num = Number(args[0]);
        if (isNaN(num)) throw new Error('#VALUE!');
        return Math.abs(num);
      }
      case 'ROUND': {
        const num = Number(args[0]);
        const dec = Number(args[1] ?? 0);
        if (isNaN(num) || isNaN(dec)) throw new Error('#VALUE!');
        const f = Math.pow(10, dec);
        return Math.round(num * f) / f;
      }
      case 'ROUNDUP': {
        const num = Number(args[0]);
        const dec = Number(args[1] ?? 0);
        if (isNaN(num) || isNaN(dec)) throw new Error('#VALUE!');
        const f = Math.pow(10, dec);
        return Math.ceil(num * f) / f;
      }
      case 'ROUNDDOWN': {
        const num = Number(args[0]);
        const dec = Number(args[1] ?? 0);
        if (isNaN(num) || isNaN(dec)) throw new Error('#VALUE!');
        const f = Math.pow(10, dec);
        return Math.floor(num * f) / f;
      }
      case 'MOD': {
        const n = Number(args[0]);
        const d = Number(args[1]);
        if (isNaN(n) || isNaN(d)) throw new Error('#VALUE!');
        if (d === 0) throw new Error('#DIV/0!');
        return n % d;
      }
      case 'POWER': {
        const base = Number(args[0]);
        const exp = Number(args[1]);
        if (isNaN(base) || isNaN(exp)) throw new Error('#VALUE!');
        return Math.pow(base, exp);
      }
      case 'SQRT': {
        const num = Number(args[0]);
        if (isNaN(num) || num < 0) throw new Error('#NUM!');
        return Math.sqrt(num);
      }
      case 'INT': {
        const num = Number(args[0]);
        if (isNaN(num)) throw new Error('#VALUE!');
        return Math.floor(num);
      }
      case 'MEDIAN': {
        const nums = this.flattenNumbers(args, currentSheetId).sort((a, b) => a - b);
        if (nums.length === 0) throw new Error('#NUM!');
        const mid = Math.floor(nums.length / 2);
        return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
      }

      // Logical
      case 'IF': {
        const condition = Boolean(args[0]);
        const trueVal = args[1] !== undefined ? args[1] : true;
        const falseVal = args[2] !== undefined ? args[2] : false;
        return condition ? trueVal : falseVal;
      }
      case 'IFS': {
        for (let i = 0; i < args.length; i += 2) {
          if (Boolean(args[i])) {
            return args[i + 1];
          }
        }
        throw new Error('#N/A');
      }
      case 'AND': {
        const all = this.flattenAll(args, currentSheetId);
        return all.length > 0 && all.every((x) => Boolean(x));
      }
      case 'OR': {
        const all = this.flattenAll(args, currentSheetId);
        return all.some((x) => Boolean(x));
      }
      case 'NOT': {
        return !Boolean(args[0]);
      }
      case 'ISBLANK': {
        return args[0] === null || args[0] === '' || args[0] === undefined;
      }
      case 'ISNUMBER': {
        return typeof args[0] === 'number' && !isNaN(args[0]);
      }
      case 'ISTEXT': {
        return typeof args[0] === 'string';
      }

      // Text
      case 'CONCAT':
      case 'CONCATENATE': {
        const all = this.flattenAll(args, currentSheetId);
        return all.map((x) => (x === null || x === undefined ? '' : String(x))).join('');
      }
      case 'TEXTJOIN': {
        const delimiter = String(args[0] ?? '');
        const ignoreEmpty = Boolean(args[1]);
        const rest = this.flattenAll(args.slice(2), currentSheetId);
        const filtered = ignoreEmpty ? rest.filter((x) => x !== null && x !== '') : rest;
        return filtered.map((x) => String(x ?? '')).join(delimiter);
      }
      case 'UPPER': {
        return String(args[0] ?? '').toUpperCase();
      }
      case 'LOWER': {
        return String(args[0] ?? '').toLowerCase();
      }
      case 'PROPER': {
        return String(args[0] ?? '').replace(
          /\b[a-z]/g,
          (letter) => letter.toUpperCase()
        );
      }
      case 'TRIM': {
        return String(args[0] ?? '').trim().replace(/\s+/g, ' ');
      }
      case 'LEN': {
        return String(args[0] ?? '').length;
      }
      case 'LEFT': {
        const str = String(args[0] ?? '');
        const count = Number(args[1] ?? 1);
        return str.substring(0, Math.max(0, count));
      }
      case 'RIGHT': {
        const str = String(args[0] ?? '');
        const count = Number(args[1] ?? 1);
        return str.substring(Math.max(0, str.length - count));
      }
      case 'MID': {
        const str = String(args[0] ?? '');
        const start = Math.max(1, Number(args[1] ?? 1)) - 1;
        const length = Number(args[2] ?? 0);
        return str.substring(start, start + length);
      }

      // Lookup
      case 'VLOOKUP': {
        const lookupVal = args[0];
        const rangeArg = args[1];
        const colIndex = Number(args[2]);
        const isExact = args[3] !== undefined ? !Boolean(args[3]) : true;

        if (!rangeArg || !rangeArg.isRange) throw new Error('#VALUE!');
        const range = parseRange(rangeArg.value);
        if (colIndex < 1 || range.startCol + colIndex - 1 > range.endCol) {
          throw new Error('#REF!');
        }

        const targetSheet = range.sheetName
          ? this.store.getSheetByName(range.sheetName)?.id
          : currentSheetId;

        for (let r = range.startRow; r <= range.endRow; r++) {
          const keyRef = coordsToRef(range.startCol, r);
          const cell = this.store.getCell(keyRef, targetSheet);
          const cellVal = cell?.computed ?? cell?.raw;

          const match = isExact
            ? String(cellVal).toLowerCase() === String(lookupVal).toLowerCase()
            : cellVal == lookupVal;

          if (match) {
            const targetCol = range.startCol + colIndex - 1;
            const resCell = this.store.getCell(coordsToRef(targetCol, r), targetSheet);
            let val = resCell?.computed ?? resCell?.raw ?? '';
            if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') {
              val = Number(val);
            }
            return val;
          }
        }
        throw new Error('#N/A');
      }

      case 'INDEX': {
        const rangeArg = args[0];
        const rowNum = Number(args[1] ?? 1);
        const colNum = Number(args[2] ?? 1);

        if (!rangeArg || !rangeArg.isRange) throw new Error('#VALUE!');
        const range = parseRange(rangeArg.value);
        const r = range.startRow + rowNum - 1;
        const c = range.startCol + colNum - 1;

        if (r < range.startRow || r > range.endRow || c < range.startCol || c > range.endCol) {
          throw new Error('#REF!');
        }

        const targetSheet = range.sheetName
          ? this.store.getSheetByName(range.sheetName)?.id
          : currentSheetId;

        const cell = this.store.getCell(coordsToRef(c, r), targetSheet);
        let val = cell?.computed ?? cell?.raw ?? '';
        if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') {
          val = Number(val);
        }
        return val;
      }

      case 'MATCH': {
        const lookupVal = args[0];
        const rangeArg = args[1];
        if (!rangeArg || !rangeArg.isRange) throw new Error('#VALUE!');

        const vals = this.expandRangeValues(rangeArg, currentSheetId);
        for (let i = 0; i < vals.length; i++) {
          if (String(vals[i]).toLowerCase() === String(lookupVal).toLowerCase()) {
            return i + 1; // 1-indexed in spreadsheets
          }
        }
        throw new Error('#N/A');
      }

      // Date & Time
      case 'TODAY': {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
      }
      case 'NOW': {
        return new Date().toISOString();
      }
      case 'YEAR': {
        const str = String(args[0]);
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
          return parseInt(str.split('-')[0], 10);
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
      }
      case 'MONTH': {
        const str = String(args[0]);
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
          return parseInt(str.split('-')[1], 10);
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date().getMonth() + 1 : d.getMonth() + 1;
      }
      case 'DAY': {
        const str = String(args[0]);
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
          return parseInt(str.split('-')[2], 10);
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date().getDate() : d.getDate();
      }

      default:
        throw new Error('#NAME?');
    }
  }
}
