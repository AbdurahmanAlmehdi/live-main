import { loadFont as loadSans } from '@remotion/google-fonts/AtkinsonHyperlegibleNext';
import { loadFont as loadMono } from '@remotion/google-fonts/AtkinsonHyperlegibleMono';

/** The app's C2 tokens (apps/web/src/styles/tokens.css). */
export const C = {
  paper: '#FBFAF7',
  sunken: '#F3F1EB',
  raised: '#FFFFFF',
  selected: '#EFECE4',
  border: '#E3DFD4',
  borderStrong: '#CDC8BA',
  ink: '#1F1D1A',
  ink2: '#58544C',
  muted: '#67635A',
  teal: '#0C6A73',
  tealSubtle: '#E2EFEF',
  green: '#1D7347',
  greenBg: '#E6F2E9',
  blue: '#1E5BB0',
  blueBg: '#E6EEF9',
  amber: '#835600',
  amberBg: '#F7EDD9',
  red: '#B42F25',
  redBg: '#FAE9E6',
  term: '#1F1D1A',
};

export const SANS = loadSans('normal', { weights: ['400', '500', '700'], subsets: ['latin'] }).fontFamily;
export const MONO = loadMono('normal', { weights: ['400', '500'], subsets: ['latin'] }).fontFamily;

export const FPS = 30;
