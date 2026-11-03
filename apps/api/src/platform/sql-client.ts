export type SqlClient = {
  query<Row extends Record<string, unknown>>(
    text: string,
    values: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
};

export type TransactionalSqlClient = SqlClient & {
  transaction<T>(callback: (client: SqlClient) => Promise<T>): Promise<T>;
};
