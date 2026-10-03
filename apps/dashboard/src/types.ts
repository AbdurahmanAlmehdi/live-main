import type { OverlayState, RunEvent, StrategyName } from '@livemain/protocol';

export interface SeqEvent {
  seq: number;
  event: RunEvent;
}

/** One entry of GET /api/runs (edge returns only runId; the local hub adds the rest). */
export interface RunListing {
  runId: string;
  strategy?: StrategyName;
  createdAt?: number;
  state?: unknown;
}

export type ConnState = 'connecting' | 'live' | 'polling' | 'offline' | 'mock';

export interface SourceHandlers {
  events(batch: SeqEvent[]): void;
  overlays(list: OverlayState[]): void;
  status(state: ConnState): void;
}

/** A stream of one run's events plus periodic overlay snapshots. */
export interface RunSource {
  readonly runId: string;
  connect(handlers: SourceHandlers): void;
  close(): void;
  /** Wall clock for the run (mock runs on a simulated clock). */
  now(): number;
}

export type CellState = 'pending' | 'landed' | 'green' | 'failing' | 'broken';
