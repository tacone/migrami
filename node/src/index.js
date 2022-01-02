import yargs from "yargs";
import migrations from "./utils/migrations.js";

export default async function migrami(config) {
  migrations.configure(config);

  await migrations.connect();

  await migrations.ensureTable();

  // use yargs to read command and arguments
  const argv = yargs(process.argv.slice(2))
    .parserConfiguration({
      "boolean-negation": true,
      "camel-case-expansion": true,
      "combine-arrays": false,
      "dot-notation": false,
      "duplicate-arguments-array": false,
      "flatten-duplicate-arrays": false,
      "halt-at-non-option": false,
      "parse-numbers": false,
      "populate--": false,
      "set-placeholder-key": false,
      "short-option-groups": true,
      "sort-commands": false,
      "strip-aliased": true,
      "strip-dashed": true,
      "unknown-options-as-args": false,
    })
    .usage("Usage: $0 <command> [options]")
    .command(
      "migrate",
      "Migrate the database to the latest version",
      async (yargs) => {
        const status = await migrations.migrate();
        process.exit(status || 0);
      },
      () => {}
    )
    .command(
      "commit",
      "Commit the current migration",
      async (yargs) => {
        yargs.options({
          message: {
            alias: "m",
            describe: "Message",
            type: "string",
          },
        });

        const message = yargs.argv?.message;

        const status = await migrations.commit(message);
        process.exit(status || 0);
      },
      () => {}
    )
    .command(
      "uncommit",
      "Uncommit the last committed migration",
      async (yargs) => {
        const status = await migrations.uncommit();
        process.exit(status || 0);
      },
      () => {}
    )
    .command(
      "down",
      "Remove the last migration from the migrations table",
      async (yargs) => {
        const status = await migrations.down();
        process.exit(status || 0);
      }
    )
    .command(
      "watch",
      "Apply the current migration at every save",
      async (yargs) => {
        await migrations.watch();
        // do not exit
      }
    )
    .command(
      "reset",
      "Remove all migrations from the migrations table",
      async (yargs) => {
        const status = await migrations.reset();
        process.exit(status || 0);
      }
    )
    .command(
      "up",
      "Apply the next unapplied migration to the database",
      async (yargs) => {
        const status = await migrations.up();
        process.exit(status || 0);
      }
    )
    .command(
      "version",
      "Print the current version of the database",
      {},
      (yargs) => {}
    )
    // watch
    .command("help", "Print this help message", {}, (yargs) => {})
    .strictCommands()
    .strictOptions()
    .demandCommand(1, 1, "Please specify a command")
    .recommendCommands()
    .help("h")
    .alias("h", "help").argv;
}
