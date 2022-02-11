# Migrami

Naive Postgres migrations for Node, partially inspired by [Graphile Migrate](https://github.com/graphile/migrate).

Migrami prioritizes **fast iteration** and a **native SQL approach**, to help you build your database as fast as possible, while leveraging the whole power of Postgres.

Keep your logic in the DB layer, use views, constraints, generated fields and more, while
the watcher applies the changes to your database everytime you save the file. When you are
done, commit the current migration to save it in the migrations folder and version it with
the rest of your project.

|     | Feature        | Description                                                |
| --- | -------------- | ---------------------------------------------------------- |
| 🧒  | Easy to use    | Almost plug and play                                       |
| 🏁  | Fast iteration | Work on current.sql and have its sql applied at every save |
| ⛑️  | Safe           | Migrations are wrapped in transactions                     |
| 👉  | Sql only       | Write your migrations directly in SQL                      |
| 🔧  | Customizable   | Pluggable templates and sql highlighting                   |

Things to consider:

|     | Constraint    | Keep in mind                                                 |
| --- | ------------- | ------------------------------------------------------------ |
| 💥  | Alpha         | Everything is likely to change and not work properly         |
| 💥  | Experimental  | Untested in production                                       |
| 👉  | Postgres only | Only works with Postgres                                     |
| 👉  | Forward only  | No down migrations, you are expected to write idempotent sql |

## Installation

```shell
npm install migrami
```

Then in the root of your project create the default `migrations` directory and `current.sql` file:

```shell
mkdir -p migrations/committed
touch migrations/current.sql
```

## Examples

### Basic usage

```js
// migrami.js

import migrami from "migrami";

migrami({
  connectionString: process.env.DATABASE_URL,
});
```

Then run `node migrami.js` to see the available options.

You will get something like this (the sample below may be outdated):

```
Usage: migrami.js <command> [options]

Commands:
  migrami.js migrate   Migrate the database to the latest version
  migrami.js commit    Commit the current migration
  migrami.js uncommit  Uncommit the last committed migration
  migrami.js down      Remove the last migration from the migrations table
  migrami.js watch     Apply the current migration at every save
  migrami.js reset     Remove all migrations from the migrations table
  migrami.js up        Apply the next unapplied migration to the database
  migrami.js config    Print the current configuration
  migrami.js help      Print this help message

Options:
  -h, --help  Show help                                                [boolean]

Please specify a command
```

### Full example

In this example we use ETA to interpolate the templates and cli-highlight to highlight the sql code.

Install these additional dependencies:

```shell
yarn add eta cli-highlight
```

Then:

```js
// migrami.js

import migrami from "migrami";
import * as eta from "eta";
import { highlight } from "cli-highlight";

eta.configure({
  autoEscape: false,
  useWith: true,
});

migrami({
  // allow templating in migration files
  interpolate: (sql) => {
    return eta.render(sql, { env: process.env });
  },

  // highlight sql errors in the console
  highlightSql: (sql) => {
    return highlight(sql, { language: "sql", ignoreIllegals: true });
  },

  // set custom connection string and paths
  connectionString: process.env.DATABASE_URL,
  migrationsPath: "./migrations/committed",
  currentPath: "./migrations/current.sql",

  // also use a different table and schema
  schema: "app",
  table: "my_migrations_table",
});
```

You can then write this code in a file called `current.sql` and run it with `node migrami.js watch`:

```sql
SELECT '<%= JSON.stringify(env) %>';
```

If you write invalid SQL in the `current.sql` file, you will get a syntax highlighted SQL error.

# Development

run:

```shell
scripts/dev up
```

then in another terminal run:

```shell
scripts/dev exec node sh
```

and you are all set to go. Please keep in mind that at the moment there are no tests.
