import { RangeValue, type Scalar, type Value } from '../core/value';
import { err, errorFromCode, isError } from '../core/errors';
import { checkNumber, toNumber, toText } from '../core/coerce';
import { compareScalars } from '../core/compare';
import { registry as defaultRegistry } from '../core/registry';
import type { FormulaFunction, FunctionLoader } from '../core/types';
import { parse, type BinaryOperator, type Node } from './parser';

export interface EvaluateOptions {
  /** Function registry to resolve names against (defaults to src/core/registry.ts). */
  registry?: Readonly<Record<string, FunctionLoader>>;
}

/**
 * Evaluates a formula such as "=ROUND(PI(), 2)" to a Value.
 * Unknown functions and names give #NAME?; malformed formulas throw FormulaSyntaxError.
 */
export async function evaluate(formula: string, options: EvaluateOptions = {}): Promise<Value> {
  const registry = options.registry ?? defaultRegistry;
  return normalize(await evalNode(parse(formula), registry));
}

type Registry = Readonly<Record<string, FunctionLoader>>;

async function evalNode(node: Node, registry: Registry): Promise<Value> {
  switch (node.kind) {
    case 'number':
    case 'string':
    case 'boolean':
      return node.value;
    case 'error':
      return errorFromCode(node.code);
    case 'missing':
      return null;
    case 'array':
      return new RangeValue(node.values.map((row) => [...row]));
    case 'name':
      return err.name;
    case 'unary': {
      const operand = await evalNode(node.operand, registry);
      return lift1(operand, (v) => {
        const n = toNumber(v);
        if (isError(n)) return n;
        return node.op === '-' ? -n : n;
      });
    }
    case 'percent': {
      const operand = await evalNode(node.operand, registry);
      return lift1(operand, (v) => {
        const n = toNumber(v);
        return isError(n) ? n : n / 100;
      });
    }
    case 'binary': {
      const left = await evalNode(node.left, registry);
      const right = await evalNode(node.right, registry);
      return lift2(left, right, (a, b) => applyBinary(node.op, a, b));
    }
    case 'call':
      return callFunction(node.name, node.args, registry);
  }
}

async function callFunction(name: string, argNodes: Node[], registry: Registry): Promise<Value> {
  const loader = Object.hasOwn(registry, name) ? registry[name] : undefined;
  if (!loader) return err.name;
  const fn: FormulaFunction = (await loader()).default;
  const args: Value[] = [];
  for (const argNode of argNodes) args.push(await evalNode(argNode, registry));
  if (args.length < fn.minArgs || args.length > fn.maxArgs) return err.na;
  return fn.call(args, { functionName: name });
}

function applyBinary(op: BinaryOperator, a: Scalar, b: Scalar): Scalar {
  if (op === '&') {
    const left = toText(a);
    if (isError(left)) return left;
    const right = toText(b);
    if (isError(right)) return right;
    return left + right;
  }
  if (op === '=' || op === '<>' || op === '<' || op === '>' || op === '<=' || op === '>=') {
    if (isError(a)) return a;
    if (isError(b)) return b;
    const c = compareScalars(a, b);
    switch (op) {
      case '=': return c === 0;
      case '<>': return c !== 0;
      case '<': return c < 0;
      case '>': return c > 0;
      case '<=': return c <= 0;
      case '>=': return c >= 0;
    }
  }
  const x = toNumber(a);
  if (isError(x)) return x;
  const y = toNumber(b);
  if (isError(y)) return y;
  switch (op) {
    case '+': return checkNumber(x + y);
    case '-': return checkNumber(x - y);
    case '*': return checkNumber(x * y);
    case '/': return y === 0 ? err.div0 : checkNumber(x / y);
    case '^': return power(x, y);
  }
}

function power(base: number, exponent: number): Scalar {
  if (base === 0 && exponent === 0) return err.num;
  if (base === 0 && exponent < 0) return err.div0;
  return checkNumber(Math.pow(base, exponent));
}

/** Applies a scalar operation to every cell of a range (or to a scalar). */
function lift1(value: Value, fn: (v: Scalar) => Scalar): Value {
  if (!(value instanceof RangeValue)) return fn(value);
  return new RangeValue(value.rows.map((row) => row.map(fn)));
}

/**
 * Applies a scalar operation pairwise, broadcasting like a spreadsheet array formula:
 * a single row/column is repeated to match the other side, and cells outside a
 * mismatched shape become #N/A.
 */
function lift2(a: Value, b: Value, fn: (x: Scalar, y: Scalar) => Scalar): Value {
  if (!(a instanceof RangeValue) && !(b instanceof RangeValue)) return fn(a, b);
  const left = a instanceof RangeValue ? a : new RangeValue([[a]]);
  const right = b instanceof RangeValue ? b : new RangeValue([[b]]);
  const height = Math.max(left.height, right.height);
  const width = Math.max(left.width, right.width);
  const rows: Scalar[][] = [];
  for (let r = 0; r < height; r++) {
    const row: Scalar[] = [];
    for (let c = 0; c < width; c++) {
      const x = pick(left, r, c);
      const y = pick(right, r, c);
      row.push(x === undefined || y === undefined ? err.na : fn(x, y));
    }
    rows.push(row);
  }
  return new RangeValue(rows);
}

function pick(range: RangeValue, r: number, c: number): Scalar | undefined {
  const row = range.height === 1 ? 0 : r;
  const col = range.width === 1 ? 0 : c;
  return row < range.height && col < range.width ? range.at(row, col) : undefined;
}

/** Final clean-up of a result: non-finite numbers become #NUM!, -0 becomes 0. */
function normalize(value: Value): Value {
  if (typeof value === 'number') return checkNumber(value);
  return value;
}
