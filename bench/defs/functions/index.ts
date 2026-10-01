import type { FnSpec } from '../types.ts';
import { math } from './math.ts';
import { statistical } from './statistical.ts';
import { text } from './text.ts';
import { logical } from './logical.ts';
import { date } from './date.ts';
import { lookup } from './lookup.ts';
import { information } from './information.ts';
import { financial } from './financial.ts';
import { engineering } from './engineering.ts';
import { distributions } from './distributions.ts';

export const allSpecs: FnSpec[] = [...math, ...statistical, ...text, ...logical, ...date, ...lookup, ...information, ...financial, ...engineering, ...distributions];
