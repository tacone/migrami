const defaults = {
  // connection string from environment variables
  connectionString: null,
  // path of current.sql
  currentPath: `${process.cwd()}/migrations/current.sql`,
  // path of migration files
  migrationsPath: `${process.cwd()}/migrations/committed`,
  // setup
  autoSetup: true,
  schema: null,
  schemaNoWarn: false,
  attemptCreateSchema: true,
  table: "migrations",
  // watcher
  watchMaxEmptySaves: 3,
  watchMaxEmptySavesInterval: 800, // ms
};

let environnment = {
  ...defaults,
  connectionString: process.env.DATABASE_URL,
  migrationsPath: process.env.MIGRATIONS_PATH,
  currentPath: process.env.CURRENT_PATH,
};

const config = {
  ...defaults,
  ...environnment,
};

export { defaults, config };
