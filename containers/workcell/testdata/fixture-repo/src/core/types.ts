import type { Value } from './value';

export type FormulaFunction = (args: Value[]) => Value;
export type FunctionLoader = () => Promise<{ default: FormulaFunction }>;
