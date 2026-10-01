import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the bench/ directory. */
export const BENCH = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Absolute path of the stubbed demo repo. */
export const DEMO_REPO = join(BENCH, '..', 'demo-repo');
export const REFERENCE = join(BENCH, 'reference');
export const SOLUTIONS = join(BENCH, 'solutions');
