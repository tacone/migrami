import { highlight } from "cli-highlight";
import * as eta from "eta";
import migrami from "../index.js";

eta.configure({
  autoEscape: false,
  useWith: true,
});

const renderTemplate = (sql) => {
  return eta.render(sql, { env: process.env });
};

migrami({
  interpolate: renderTemplate,

  highlightSql: (sql) => {
    return highlight(sql, { language: "sql", ignoreIllegals: true });
  },

  connectionString: process.env.DATABASE_URL,
});
