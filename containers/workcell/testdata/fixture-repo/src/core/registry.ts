import type { FunctionLoader } from './types';

export const registry: Record<string, FunctionLoader> = {
  SUM: () => import('../functions/math/SUM'),
  AVERAGE: () => import('../functions/math/AVERAGE'),
  CONCAT: () => import('../functions/text/CONCAT'),
  // functions (one per line, keep this marker as the last line inside the object)
};
