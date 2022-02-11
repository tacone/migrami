import fs from "fs";
import path from "path";
import pgMinify from "pg-minify";
import { SQLParsingError } from "pg-minify/lib/error.js";
import { DatabaseError } from "pg-protocol";
import { defaults } from "../config.js";
import { connect as connectDB, withTransaction } from "./db.js";
import { logDatabaseError } from "./logging.js";
import { maxAttemptsChecker, timestampPacker } from "./misc.js";
import { watchFile } from "./watch.js";

// TODO:
// middleware before all migrations are run
// middleware after all migrations are run
// middleware before each migration is run
// middleware after each migration is run
// add command to check migrations have been setup
// verbose flag (log all queries)

let config = defaults;

let globals = {
  client: undefined,
  interpolate: (_) => _,
  highlightSql: (_) => _,
  table: () => {
    if (!config.table) {
      throw new Error("migrations table is not configured");
    }
    if (config.schema) {
      return `"${config.schema}"."${config.table}"`;
    } else {
      return `"${config.table}"`;
    }
  },
};

export async function configure(customConfig = {}) {
  config = { ...config, ...customConfig };

  config.interpolate && (globals.interpolate = config.interpolate);
  config.highlightSql && (globals.highlightSql = config.highlightSql);
}

export async function printConfig() {
  return console.log(config);
}

let tx = withTransaction(globals);

const interpolateSql = async function interpolateSql(sql) {
  if (!globals.interpolate) {
    return sql;
  }

  return await globals.interpolate(sql);
};

export async function connect() {
  if (!config.connectionString) {
    console.log();
    console.warn(
      "connectionString is not set, using the default postgres connection string"
    );
    console.log();
  }
  // create the postgres client
  globals.client = await connectDB(config.connectionString);
}

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
        [config.schema]
      )
    )?.rows[0]?.exists || false
  );
}

async function tableExists(table) {
  const sql = `SELECT to_regclass($1) as "exists";`;
  const { exists } = (await query(sql, [table]))?.rows[0] || {};

  return exists;
}

const status = async function status() {
  if (config.schema) {
    const schemaFound = await schemaExists(config.schema);
    if (!schemaFound) return false;
  }
  return !!(await tableExists(globals.table()));
};

const ensureTable = async function ensureTable(force = false) {
  if (!force && !config.autoSetup) return;

  if (!config.schema && !config.schemaNoWarn) {
    console.log();
    console.warn("❗ schema is not configured, using default schema");
    console.warn("this is probably not what you want");
    console.warn("configure a schema or disable this warning");
    console.log();
  }

  if (config.schema) {
    if (!(await schemaExists(config.schema))) {
      if (!config.attemptCreateSchema) {
        throw new Error(
          `schema ${config.schema} does not exist, create it or set attemptCreateSchema to true`
        );
      }
      console.log(
        `schema ${config.schema} does not exist, attempting to create it...`
      );
      await query(`CREATE SCHEMA "${config.schema}"`);
      // thumbs up schema created
      console.log(`👍 schema ${config.schema} created`);
    }
  }

  if (await tableExists(globals.table())) {
    if (force) {
      // if the user explicitly asked for the table to be setup
      // tell him that it already exists
      console.warn(`table ${globals.table()} already exists`);
    }
    // if the table already exists do nothing
    return;
  }

  await tx(async (_) => {
    console.log(`✨ creating migrations table [${globals.table()}]...`);
    return query(`
    CREATE TABLE ${globals.table()} (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      sql TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  })();

  return true;
};

const readMigration = function readMigration(filename) {
  return fs.readFileSync(filename, "utf8").trimEnd() + "\n";
};

const applied = async function applied() {
  const rows =
    (
      await query(`
        SELECT filename FROM ${globals.table()} ORDER BY id ASC
    `)
    )?.rows || [];
  return rows.map((_) => _.filename);
};

const available = async function available() {
  const migrations = fs.readdirSync(config.migrationsPath);
  return migrations.filter((migration) => {
    return migration.endsWith(".sql");
  });
};

const unapplied = async function unapplied() {
  const migrations = await available();
  const appliedMigrations = await applied();
  let unappliedMigrations = migrations.filter((migration) => {
    return !appliedMigrations.includes(migration);
  });
  // sort
  unappliedMigrations.sort();
  return unappliedMigrations;
};

const isMigrationEmpty = async (sql) => {
  let minifiedSql;
  // minify the file so we can compare it to the template
  try {
    minifiedSql = pgMinify(sql);
  } catch (error) {
    if (error instanceof SQLParsingError) {
      logDatabaseError(sql, error, globals.highlightSql);
    }
    throw error;
  }
  if (!minifiedSql) return true;
};

const commit = async function commit(message = "") {
  // read currentPath
  const sql = readMigration(config.currentPath);
  if (await isMigrationEmpty(sql)) {
    console.log("current migration is empty");
    return;
  }

  // make sure message is kebab case
  const escapedMessage = message
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .trim();

  const timestamp = timestampPacker(Date.now())
    // in a few tens years this padding will break, when that happens
    // please send a PR to bump the padStart :)
    .padStart(6, 0);

  // include message into filename
  const newFilename =
    [timestamp, escapedMessage].filter((_) => _).join("-") + ".sql";

  fs.copyFileSync(
    config.currentPath,
    path.join(config.migrationsPath, newFilename)
  );
  fs.writeFileSync(config.currentPath, "", "utf8");

  console.log(`💾 ${newFilename} committed`);
};

const uncommit = async function uncommit() {
  // if current.sql is not empty raise error
  const sql = readMigration(config.currentPath);

  if (!(await isMigrationEmpty(sql))) {
    console.log("current migration is not empty");
    return 1;
  }
  // copy the last migration to current
  const migrations = await available();
  const lastMigrationBaseName = migrations[migrations.length - 1];
  const lastMigration = path.join(config.migrationsPath, lastMigrationBaseName);
  fs.copyFileSync(lastMigration, config.currentPath);
  // delete the last migration
  fs.unlinkSync(lastMigration);
  console.log(
    `💾 ${lastMigrationBaseName} uncommitted, check ${config.currentPath}`
  );
};

const down = async function down() {
  const appliedMigrations = await applied();
  if (!appliedMigrations.length) {
    console.log("no migrations to remove");
    return;
  }
  const lastAppliedMigration = appliedMigrations.pop();
  // remove the last migration from the database
  await query(
    `
    DELETE FROM ${globals.table()}
    WHERE filename = $1
    `,
    [lastAppliedMigration]
  );

  console.log(`🔥 ${lastAppliedMigration} removed from ${globals.table()}`);

  if (!appliedMigrations.length) {
    console.log(`${globals.table()} is now empty`);
    return;
  }

  const newLastAppliedMigration = appliedMigrations.pop();
  console.log(
    `last migration in ${globals.table()} is now:`,
    newLastAppliedMigration
  );
};

const reset = async function reset() {
  await query(`DELETE FROM ${globals.table()}`);
  console.log(`🔥 removed all migrations from ${globals.table()}`);
  console.log(`${globals.table()} is now empty`);
};

const migrate = async function migrate() {
  const unappliedMigrations = await unapplied();
  if (!unappliedMigrations.length) {
    console.log("No migrations to apply");
    return 0;
  }

  let count = 0;
  for (const migration of unappliedMigrations) {
    await apply(path.join(config.migrationsPath, migration));
    count++;
  }

  console.log(`Applied ${count} migrations`);
  return count;
};

const up = async function up() {
  // get last unapplied migration
  const unappliedMigrations = await unapplied();
  if (!unappliedMigrations.length) {
    console.log("No migrations to apply");
    return 0;
  }
  const migration = unappliedMigrations[0];
  console.log("Applying:", migration);
  await apply(path.join(config.migrationsPath, migration));
};

const attemptsChecker = maxAttemptsChecker(
  config.watchMaxEmptySaves,
  config.watchMaxEmptySavesInterval
);

let latestSql;

const applyCurrentMigration = async function applyCurrentMigration(filename) {
  console.log(`🔎 watching ${filename} for changes...`);

  // log we are watching
  let sql = readMigration(filename);
  sql = await globals.interpolate(sql);
  sql = sql.trimEnd() + "\n";

  let minifiedSql;
  // minify the file so we can compare it to the current one
  try {
    minifiedSql = pgMinify(sql);
  } catch (error) {
    if (error instanceof SQLParsingError) {
      logDatabaseError(sql, error, globals.highlightSql);
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
          config.watchMaxEmptySavesInterval * remainingAttempts
        }ms to migrate`
      );
    }
  }
  // if sql changed, apply the migration
  if (minifiedSql !== latestSql) {
    latestSql = minifiedSql;

    console.log(`${filename} changed, applying the migration`);

    console.log(globals.highlightSql(sql));
    await apply(filename);
  }
};

const watch = async function watch() {
  // watch the current file
  // please note that watchFile will keep the node process from
  // terminating
  watchFile(
    config.currentPath,
    async () => {
      try {
        await applyCurrentMigration(config.currentPath);
      } catch (error) {
        console.error(error);
        console.log(`🔎 watching ${config.currentPath} for changes...`);
      }
    },
    {
      events: ["add", "change", "unlink", "ready"],
    }
  );
};

const apply = tx(async function apply(migration) {
  const filename = path.basename(migration);
  console.log("applying", filename);
  let sql = readMigration(migration);
  sql = await interpolateSql(sql);
  await query(sql);
  await query(
    `
        INSERT INTO ${globals.table()} (filename, sql)
        VALUES ($1, $2)
    `,
    [filename, sql]
  );
  console.log(`👍 ${filename} applied`);
});

export default {
  migrate,
  commit,
  connect,
  configure,
  down,
  ensureTable,
  printConfig,
  reset,
  status,
  uncommit,
  up,
  watch,
};
