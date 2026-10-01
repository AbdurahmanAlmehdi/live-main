# formula-engine

A small spreadsheet formula engine in TypeScript. It parses Excel-style formulas such as
`=ROUND(AVERAGE({1, 2, 3.5}), 1) & " units"` and evaluates them to a value. There are no
cells or sheets: arguments are literals, nested calls, and array literals like `{1, 2; 3, 4}`.

Most spreadsheet functions are not implemented yet. Each one has a test file waiting for it.

## Layout

```
src/core/       the value model and the shared building blocks every function uses
  value.ts      Value = number | string | boolean | null | FormulaError | RangeValue
  errors.ts     err.div0, err.value, err.num, err.na, ...; isError, firstError, NotImplementedError
  coerce.ts     toNumber, toInteger, toText, toBoolean, parseNumber, formatGeneral, checkNumber
  args.ts       collectNumbers, flattenArgs, optionalNumber/Integer/Boolean/Text
  range.ts      toRange, dimensions, cellsOf, fromRows, fromColumn, fromRow, mapCells, transpose
  compare.ts    compareScalars, scalarsEqual (spreadsheet ordering of values)
  types.ts      FormulaFunction, EvalContext, FunctionLoader
  registry.ts   function name → lazy loader (one line per function)
src/eval/       lexer.ts → parser.ts → evaluate.ts
src/helpers/    shared helpers for groups of functions (rounding, criteria, dates, statistics, ...).
                Some are still stubs that throw NotImplementedError.
src/functions/  one file per spreadsheet function, grouped by category
tests/core/     tests for core and the evaluator
tests/helpers/  one test file per helper module
tests/functions/one test file per function (NAME.test.ts; dots in names become "_")
```

Every module in `src/core` and `src/helpers` documents its contract in doc comments; read
them before using a helper.

## Semantics in brief

- Errors are values. Functions **return** `err.value`, `err.num`, ...; they never throw them.
  A function usually returns the first error it meets in its inputs.
- Coercion follows spreadsheet rules (`toNumber("1,000")` is 1000, `toNumber(TRUE)` is 1,
  `toNumber("abc")` is `#VALUE!`). Values typed directly as arguments and values inside
  arrays are often treated differently, see `src/core/args.ts`.
- Dates and times are serial numbers in the 1900 date system (1 is 1900-01-01, 0.5 is noon).
- Numbers that come out as NaN or ±Infinity should become `#NUM!` (`checkNumber`).

## How the evaluator finds functions

`src/core/registry.ts` maps each function name to a loader:

```ts
export const registry: Record<string, FunctionLoader> = {
  ABS: () => import('../functions/math/ABS'),
  'CEILING.MATH': () => import('../functions/math/CEILING_MATH'),
  // functions (one per line, keep this marker as the last line inside the object)
};
```

Loaders are lazy on purpose: evaluating `=ABS(-1)` only loads `ABS.ts` and what it imports.
Never import function modules eagerly or from each other. Unknown names evaluate to `#NAME?`.

## How to add a function

1. Create `src/functions/<category>/<NAME>.ts` (dots in the name become `_`) that
   default-exports a `FormulaFunction`:

   ```ts
   import type { FormulaFunction } from '../../core/types';
   import { toNumber } from '../../core/coerce';
   import { err, isError } from '../../core/errors';

   /** SQRT(number): the positive square root of a number. */
   const SQRT: FormulaFunction = {
     minArgs: 1,
     maxArgs: 1,
     call([value]) {
       const n = toNumber(value);
       if (isError(n)) return n;
       if (n < 0) return err.num;
       return Math.sqrt(n);
     },
   };

   export default SQRT;
   ```

   The evaluator checks the argument count before calling `call`, and passes arguments
   already evaluated (errors included). Use the core and helper modules rather than
   re-implementing coercion, argument flattening or error handling.

2. Register it with **one line** in `src/core/registry.ts`, just before the marker comment:

   ```ts
     SQRT: () => import('../functions/math/SQRT'),
   ```

   Quote names that contain dots: `'NORM.S.DIST': () => import('../functions/statistical/NORM_S_DIST'),`.

3. Run its tests:

   ```sh
   npx vitest run tests/functions/SQRT.test.ts
   ```

## Commands

```sh
npm ci                    # install
npx vitest run            # whole suite
npx vitest run tests/core # core only
npx tsc --noEmit          # typecheck
```
