import type { Row, SqlStore, SqlValue } from '@livemain/core';

/** SqlStore over Durable Object SQLite storage. */
export function doSqlStore(storage: DurableObjectStorage): SqlStore {
  return {
    all<T extends Row = Row>(query: string, ...params: SqlValue[]): T[] {
      return storage.sql.exec(query, ...params).toArray() as T[];
    },
    script(sql: string) {
      storage.sql.exec(sql);
    },
    transaction<T>(fn: () => T): T {
      return storage.transactionSync(fn);
    },
  };
}
