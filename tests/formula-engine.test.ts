import { describe, it, expect, beforeEach } from 'vitest';
import { CellStore } from '../src/core/cell-store';
import { FormulaEngine } from '../src/core/formula-engine';

describe('FormulaEngine', () => {
  let store: CellStore;
  let engine: FormulaEngine;

  beforeEach(() => {
    store = new CellStore();
    engine = new FormulaEngine(store);
  });

  it('evaluates literals and non-formulas', () => {
    expect(engine.evaluate('123').value).toBe(123);
    expect(engine.evaluate('45.67').value).toBe(45.67);
    expect(engine.evaluate('Hello').value).toBe('Hello');
    expect(engine.evaluate('TRUE').value).toBe(true);
    expect(engine.evaluate('FALSE').value).toBe(false);
  });

  it('evaluates basic arithmetic operators and precedence', () => {
    expect(engine.evaluate('=10 + 20').value).toBe(30);
    expect(engine.evaluate('=50 - 15').value).toBe(35);
    expect(engine.evaluate('=6 * 7').value).toBe(42);
    expect(engine.evaluate('=100 / 4').value).toBe(25);
    expect(engine.evaluate('=2 ^ 3').value).toBe(8);
    expect(engine.evaluate('=2 + 3 * 4').value).toBe(14);
    expect(engine.evaluate('=(2 + 3) * 4').value).toBe(20);
    expect(engine.evaluate('=-5 + 10').value).toBe(5);
  });

  it('evaluates comparisons and string concatenation', () => {
    expect(engine.evaluate('="Hello" & " " & "World"').value).toBe('Hello World');
    expect(engine.evaluate('=10 > 5').value).toBe(true);
    expect(engine.evaluate('=10 < 5').value).toBe(false);
    expect(engine.evaluate('=10 = 10').value).toBe(true);
    expect(engine.evaluate('=10 <> 5').value).toBe(true);
  });

  it('evaluates math functions with ranges and numbers', () => {
    store.setCellRaw('A1', '10');
    store.setCellRaw('A2', '20');
    store.setCellRaw('A3', '30');

    expect(engine.evaluate('=SUM(A1:A3)').value).toBe(60);
    expect(engine.evaluate('=AVERAGE(A1:A3)').value).toBe(20);
    expect(engine.evaluate('=MIN(A1:A3)').value).toBe(10);
    expect(engine.evaluate('=MAX(A1:A3)').value).toBe(30);
    expect(engine.evaluate('=COUNT(A1:A3)').value).toBe(3);
    expect(engine.evaluate('=PRODUCT(A1, A2)').value).toBe(200);
    expect(engine.evaluate('=ROUND(3.14159, 2)').value).toBe(3.14);
    expect(engine.evaluate('=ABS(-42)').value).toBe(42);
    expect(engine.evaluate('=MOD(10, 3)').value).toBe(1);
    expect(engine.evaluate('=POWER(3, 2)').value).toBe(9);
    expect(engine.evaluate('=SQRT(16)').value).toBe(4);
  });

  it('evaluates logical functions IF, IFS, AND, OR, NOT', () => {
    expect(engine.evaluate('=IF(10 > 5, "Yes", "No")').value).toBe('Yes');
    expect(engine.evaluate('=IF(5 > 10, "Yes", "No")').value).toBe('No');
    expect(engine.evaluate('=AND(10 > 5, 20 > 10)').value).toBe(true);
    expect(engine.evaluate('=AND(10 > 5, 5 > 10)').value).toBe(false);
    expect(engine.evaluate('=OR(5 > 10, 10 > 5)').value).toBe(true);
    expect(engine.evaluate('=NOT(10 > 5)').value).toBe(false);
    expect(engine.evaluate('=IFS(1=2, "first", 2=2, "second")').value).toBe('second');
  });

  it('evaluates text functions UPPER, LOWER, TRIM, LEN, LEFT, RIGHT, MID, CONCAT', () => {
    expect(engine.evaluate('=UPPER("hello")').value).toBe('HELLO');
    expect(engine.evaluate('=LOWER("WORLD")').value).toBe('world');
    expect(engine.evaluate('=TRIM("   extra   spaces   ")').value).toBe('extra spaces');
    expect(engine.evaluate('=LEN("spreadsheet")').value).toBe(11);
    expect(engine.evaluate('=LEFT("Google", 4)').value).toBe('Goog');
    expect(engine.evaluate('=RIGHT("Google", 2)').value).toBe('le');
    expect(engine.evaluate('=MID("Google", 2, 3)').value).toBe('oog');
    expect(engine.evaluate('=TEXTJOIN(", ", TRUE, "A", "B", "C")').value).toBe('A, B, C');
  });

  it('evaluates lookup functions VLOOKUP, INDEX, MATCH', () => {
    store.setCellRaw('A1', 'Apple');
    store.setCellRaw('B1', '1.50');
    store.setCellRaw('A2', 'Banana');
    store.setCellRaw('B2', '0.75');
    store.setCellRaw('A3', 'Cherry');
    store.setCellRaw('B3', '3.00');

    expect(engine.evaluate('=VLOOKUP("Banana", A1:B3, 2)').value).toBe(0.75);
    expect(engine.evaluate('=MATCH("Cherry", A1:A3)').value).toBe(3);
    expect(engine.evaluate('=INDEX(A1:B3, 1, 2)').value).toBe(1.5);
  });

  it('evaluates date functions TODAY, YEAR, MONTH, DAY', () => {
    const todayRes = engine.evaluate('=TODAY()').value;
    expect(todayRes).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(engine.evaluate('=YEAR("2026-09-06")').value).toBe(2026);
    expect(engine.evaluate('=MONTH("2026-09-06")').value).toBe(9);
    expect(engine.evaluate('=DAY("2026-09-06")').value).toBe(6);
  });

  it('handles division by zero and errors correctly', () => {
    expect(engine.evaluate('=10 / 0').error).toBe('#DIV/0!');
    expect(engine.evaluate('=UNKNOWNFUNC()').error).toBe('#NAME?');
    expect(engine.evaluate('=VLOOKUP("NotThere", A1:B3, 2)').error).toBe('#N/A');
  });

  it('extracts dependencies from formulas', () => {
    const deps = engine.extractDependencies('=A1 + SUM(B1:B3) + Sheet2!C5');
    expect(deps).toContain('A1');
    expect(deps).toContain('B1');
    expect(deps).toContain('B2');
    expect(deps).toContain('B3');
    expect(deps).toContain('Sheet2!C5');
  });
});
