/**
 * Evaluates a formula with formula.js, to produce oracle expectations.
 *
 * The formula is parsed with the demo repo's own parser (so the oracle sees exactly the
 * same syntax the engine does); each call node is dispatched to the formula.js function
 * of the same name. Operators are evaluated with plain JS number semantics, which is all
 * the cases need (they are used for things like =-1 or =1/3 inside arguments).
 */
import { createRequire } from 'node:module';
import { parse, type Node } from '../../demo-repo/src/eval/parser.ts';
import type { ErrorCode, Expected } from '../defs/types.ts';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fjs: any = require('@formulajs/formulajs');

const ERROR_BY_CODE: Record<ErrorCode, Error> = {
  '#NULL!': fjs.utils.errors.nil,
  '#DIV/0!': fjs.utils.errors.div0,
  '#VALUE!': fjs.utils.errors.value,
  '#REF!': fjs.utils.errors.ref,
  '#NAME?': fjs.utils.errors.name,
  '#NUM!': fjs.utils.errors.num,
  '#N/A': fjs.utils.errors.na,
};
const CODES = new Set(Object.keys(ERROR_BY_CODE));

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

export class OracleError extends Error {}

/** Finds the formula.js implementation for a spreadsheet function name. */
export function resolveOracle(name: string): ((...args: unknown[]) => unknown) | undefined {
  const direct = fjs[name];
  if (typeof direct === 'function') return direct;
  let node = fjs;
  for (const part of name.split('.')) node = node?.[part];
  if (typeof node === 'function') return node;
  const joined = fjs[name.replace(/\./g, '')];
  return typeof joined === 'function' ? joined : undefined;
}

export function oracleEvaluate(formula: string, nameMap: Record<string, string> = {}): Expected {
  const raw = evalNode(parse(formula), nameMap);
  return toExpected(raw);
}

function evalNode(node: Node, nameMap: Record<string, string>): unknown {
  switch (node.kind) {
    case 'number':
    case 'string':
    case 'boolean':
      return node.value;
    case 'error':
      return ERROR_BY_CODE[node.code];
    case 'missing':
      return null;
    case 'array':
      return node.values.map((row) => row.map((cell) => (cell !== null && typeof cell === 'object' ? ERROR_BY_CODE[cell.code] : cell)));
    case 'name':
      throw new OracleError(`bare name ${node.name} in oracle case`);
    case 'unary': {
      const v = evalNode(node.operand, nameMap);
      return node.op === '-' ? -Number(v) : Number(v);
    }
    case 'percent':
      return Number(evalNode(node.operand, nameMap)) / 100;
    case 'binary': {
      const a = evalNode(node.left, nameMap);
      const b = evalNode(node.right, nameMap);
      if (a instanceof Error) return a;
      if (b instanceof Error) return b;
      switch (node.op) {
        case '+': return Number(a) + Number(b);
        case '-': return Number(a) - Number(b);
        case '*': return Number(a) * Number(b);
        case '/': return Number(b) === 0 ? ERROR_BY_CODE['#DIV/0!'] : Number(a) / Number(b);
        case '^': return Math.pow(Number(a), Number(b));
        case '&': return String(a) + String(b);
        case '>': return Number(a) > Number(b);
        case '<': return Number(a) < Number(b);
        case '>=': return Number(a) >= Number(b);
        case '<=': return Number(a) <= Number(b);
        case '=': return a === b;
        case '<>': return a !== b;
        default: throw new OracleError('operator not supported in oracle cases');
      }
    }
    case 'call': {
      const fn = resolveOracle(nameMap[node.name] ?? node.name);
      if (!fn) throw new OracleError(`formula.js has no ${node.name}`);
      const args = node.args.map((a) => evalNode(a, nameMap));
      try {
        return fn(...args);
      } catch (e) {
        throw new OracleError(`formula.js ${node.name} threw: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}

function toExpected(raw: unknown): Expected {
  if (raw instanceof Error) {
    if (CODES.has(raw.message)) return { error: raw.message as ErrorCode };
    throw new OracleError(`formula.js threw/returned a non-spreadsheet error: ${raw.message}`);
  }
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return { error: '#VALUE!' };
    return (raw.getTime() - EXCEL_EPOCH_MS) / DAY_MS;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? (Object.is(raw, -0) ? 0 : raw) : { error: '#NUM!' };
  }
  if (typeof raw === 'string' || typeof raw === 'boolean') return raw;
  if (Array.isArray(raw)) {
    const rows = raw.length > 0 && Array.isArray(raw[0]) ? (raw as unknown[][]) : [raw as unknown[]];
    return rows.map((row) => row.map((cell) => toExpected(cell)));
  }
  throw new OracleError(`formula.js returned ${raw === null ? 'null' : typeof raw}`);
}
