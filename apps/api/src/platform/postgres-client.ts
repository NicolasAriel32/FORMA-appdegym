import { Pool, type PoolConfig } from "pg";
import type { SqlClient, TransactionalSqlClient } from "./sql-client.js";

export type PostgresConnectionLike = {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
  release: () => void;
};

export type PostgresPoolLike = {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
  connect: () => Promise<PostgresConnectionLike>;
  end: () => Promise<void>;
};

export type CloseableTransactionalSqlClient = TransactionalSqlClient & {
  close: () => Promise<void>;
};

export function createPostgresSqlClient(
  connectionString: string,
  overrides: Pick<PoolConfig, "max" | "statement_timeout" | "application_name"> = {},
): CloseableTransactionalSqlClient {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
    max: overrides.max ?? 10,
    statement_timeout: overrides.statement_timeout ?? 5_000,
    application_name: overrides.application_name ?? "forma-api",
  });
  return createPostgresSqlClientFromPool(pool);
}

export function createPostgresSqlClientFromPool(
  pool: PostgresPoolLike,
): CloseableTransactionalSqlClient {
  return {
    query: async <Row extends Record<string, unknown>>(text: string, values: readonly unknown[]) => {
      const result = await pool.query<Row>(text, [...values]);
      return { rows: result.rows };
    },
    transaction: async <T>(callback: (client: SqlClient) => Promise<T>) => {
      const connection = await pool.connect();
      try {
        await connection.query("begin");
        const result = await callback(createTransactionClient(connection));
        await connection.query("commit");
        return result;
      } catch (error) {
        await rollbackSafely(connection);
        throw error;
      } finally {
        connection.release();
      }
    },
    close: () => pool.end(),
  };
}

function createTransactionClient(connection: PostgresConnectionLike): SqlClient {
  return {
    query: async <Row extends Record<string, unknown>>(text: string, values: readonly unknown[]) => {
      const result = await connection.query<Row>(text, [...values]);
      return { rows: result.rows };
    },
  };
}

async function rollbackSafely(connection: PostgresConnectionLike): Promise<void> {
  try {
    await connection.query("rollback");
  } catch {
    // Preserve the original application error. The connection is released below.
  }
}
