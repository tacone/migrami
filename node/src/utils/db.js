import pg from "pg";
import { DatabaseError } from "pg-protocol";

import { logDatabaseError } from "./logging.js";

// wraps a query statement into a transaction

export default function db(globals) {
  const connect = async function connect(connectionString) {
    console.log("connecting to db...");
    const client = new pg.Client(connectionString);
    await client.connect();
    console.log("connected");

    return client;
  };

  const withTransaction = function withTransaction(callback) {
    return async (...args) => {
      const { client } = globals;
      console.log("🚥 starting transaction");
      await client.query("begin");
      try {
        const result = await callback(...args);
        await client.query("commit");
        console.log("🏁 transaction over");
        return result;
      } catch (error) {
        await client.query("rollback");
        console.log("⏪ transaction rolled back");
        throw error;
      }
    };
  };

  const query = async (...args) => {
    try {
      return await globals.client.query(...args);
    } catch (error) {
      if (error instanceof DatabaseError) {
        logDatabaseError(args[0], error, globals.highlightSql);
      }
      throw error;
    }
  };

  async function schemaExists(schema) {
    return (
      (
        await query(
          `
      SELECT EXISTS (
        SELECT 1
        FROM   pg_catalog.pg_namespace
        WHERE  nspname = $1
      )
    `,
          [schema]
        )
      )?.rows[0]?.exists || false
    );
  }

  async function tableExists(table) {
    const sql = `SELECT to_regclass($1) as "exists";`;
    const { exists } = (await query(sql, [table]))?.rows[0] || {};

    return exists;
  }

  return {
    connect,
    query,
    schemaExists,
    tableExists,
    withTransaction,
  };
}
