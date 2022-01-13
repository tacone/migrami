# MigraMI

Naive Postgres migrations for Node, partially inspired by [Graphile Migrate](https://github.com/graphile/migrate).

|     | Feature        | Description                                                |
| --- | -------------- | ---------------------------------------------------------- |
| 💥  | Alpha          | Everything is likely to change and not work properly       |
| 💥  | Experimental   | Untested in production                                     |
| 🏁  | Fast iteration | Work on current.sq and have its sql applied at every save  |
| ⛑️  | Safe           | Migrations are wrapped in transactions                     |
| 👉  | Sql only       | Write your migrations directly in SQL                      |
| 👉  | Postgres only  | Only works with Postgres                                   |
| 👉  | Forward only   | No down migrations                                         |
| 🔧  | Customizable   | Pluggable migration interpolation and sql highlighting     |


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
Usage: interpolate.js <command> [options]

Commands:
  interpolate.js migrate   Migrate the database to the
                           latest version
  interpolate.js commit    Commit the current migration
  interpolate.js uncommit  Uncommit the last committed
                           migration
  interpolate.js down      Remove the last migration fr
                           om the migrations table
  interpolate.js watch     Apply the current migration
                           at every save
  interpolate.js reset     Remove all migrations from t
                           he migrations table
  interpolate.js up        Apply the next unapplied mig
                           ration to the database
  interpolate.js version   Print the current version of
                            the database
  interpolate.js help      Print this help message

Options:
      --version  Show version number          [boolean]
  -h, --help     Show help
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
  interpolate: (sql) => {
    return eta.render(sql, { env: process.env });
  },

  highlightSql: (sql) => {
    return highlight(sql, { language: "sql", ignoreIllegals: true });
  },

  connectionString: process.env.DATABASE_URL,
  migrationsPath: "./migrations/committed",
  currentPath: "./migrations/current.sql",
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
