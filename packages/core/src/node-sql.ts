import Database from 'better-sqlite3';
import type { Row, SqlStore, SqlValue } from './sql.js';

/** SqlStore over better-sqlite3, for running the coordinator in Node (local stack, tests, synthetic swarm). */
export function nodeSqlStore(file = ':memory:'): SqlStore & { close(): void } {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  const cache = new Map<string, Database.Statement>();
  const prepare = (q: string) => {
    let stmt = cache.get(q);
    if (!stmt) {
      stmt = db.prepare(q);
      cache.set(q, stmt);
    }
    return stmt;
  };
  return {
    all<T extends Row = Row>(query: string, ...params: SqlValue[]): T[] {
      const stmt = prepare(query);
      if (stmt.reader) return stmt.all(...params) as T[];
      stmt.run(...params);
      return [];
    },
    script(sql: string) {
      db.exec(sql);
    },
    transaction<T>(fn: () => T): T {
      if (db.inTransaction) return fn();
      return db.transaction(fn)();
    },
    close() {
      db.close();
    },
  };
}
