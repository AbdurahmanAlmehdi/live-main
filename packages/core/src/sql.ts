/**
 * Minimal synchronous SQL surface shared by Durable Object SQLite storage
 * (`ctx.storage.sql`) and Node SQLite (better-sqlite3). Keeps the coordinator
 * logic storage-agnostic.
 */
export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

export interface SqlStore {
  /** Run one statement; returns result rows (empty for writes). */
  all<T extends Row = Row>(query: string, ...params: SqlValue[]): T[];
  /** Run a multi-statement script (schema). */
  script(sql: string): void;
  /** Run `fn` atomically. */
  transaction<T>(fn: () => T): T;
}

export function one<T extends Row>(rows: T[]): T | undefined {
  return rows[0];
}
