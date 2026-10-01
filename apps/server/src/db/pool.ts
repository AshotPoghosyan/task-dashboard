import pg from 'pg';

export interface Database {
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export function createDatabase(connectionString: string): Database {
  const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 2000 });
  // Idle client errors must not crash the process; health checks report DB state.
  pool.on('error', () => undefined);
  return {
    async ping() {
      try {
        await pool.query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
    close: () => pool.end(),
  };
}
