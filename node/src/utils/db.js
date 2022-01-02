import pg from "pg";

// wraps a query statement into a transaction

export function withTransaction(globals) {
  return (callback) => async (...args) => {
    const {client} = globals;
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
}

export async function connect(connectionString) {
  console.log("connecting to db...");
  const client = new pg.Client(connectionString);
  await client.connect();
  console.log("connected");

  return client;
}
