import fs from "fs";
import path from "path";
import pgMinify from "pg-minify";
import createGlobals from "./utils/common-js-compat.js";
import { watchFile } from "./utils/watch.js";
import { connect, withTransaction } from "./utils/db.js";
import { DatabaseError } from "pg-protocol";
import { logDatabaseError } from "./utils/logging.js";
import { maxAttemptsChecker } from "./utils/misc.js";
import { SQLParsingError } from "pg-minify/lib/error.js";

// configuration
const maxEmptySaves = 3;
const maxEmptySavesInterval = 800; // ms

// some things we don't have by default when using ES modules
createGlobals();

// create the postgres client
const db = await connect();

// watch this file and reapply the migration everytime it changes
const currentFile = path.resolve(
  path.dirname(__filename) + "/../../migrations/current.sql"
);
console.log("will watch:", currentFile);

let latestSql;

const attemptsChecker = maxAttemptsChecker(
  maxEmptySaves,
  maxEmptySavesInterval
);

async function applyCurrentMigration(filename) {
  // read the file
  const sql = fs.readFileSync(filename, "utf8");
  let minifiedSql;

  // minify the file so we can compare it to the current one
  try {
    minifiedSql = pgMinify(sql);
  } catch (error) {
    if (error instanceof SQLParsingError) {
      logDatabaseError(sql, error);
    }
    throw error;
  }

  // if latestSql is undefined, this is the first time we've run this
  // so we don't need to migrate anything
  if (latestSql === undefined) {
    latestSql = minifiedSql;

    return false;
  }

  // saving a few times within a short timespan will trigger the migration anyways
  if (minifiedSql === latestSql) {
    const remainingAttempts = attemptsChecker();
    if (!remainingAttempts) {
      latestSql = true; // force save
      attemptsChecker(true);
    } else {
      console.log(
        `${filename} unchanged, save ${remainingAttempts} times within ${
          maxEmptySavesInterval * remainingAttempts
        }ms to migrate`
      );
    }
  }

  // if sql changed, apply the migration
  if (minifiedSql !== latestSql) {
    latestSql = minifiedSql;

    console.log(`${filename} changed, applying the migration`);

    try {
      await withTransaction(db, async () => {
        await db.query(sql);
      });
      return true;
    } catch (error) {
      if (error instanceof DatabaseError) {
        logDatabaseError(sql, error);
      }
      throw error;
    }
  }
}

async function handler(filename) {
  try {
    const result = await applyCurrentMigration(filename);
    if (result) {
      console.log("👍 migration applied");
    }
  } catch (error) {
    console.error(error);
    console.log("💥 migration failed");
  }
}

// watch the current file
// please note that watchFile will keep the node process from
watchFile(currentFile, () => handler(currentFile), {
  events: ["add", "change", "unlink", "ready"],
});
