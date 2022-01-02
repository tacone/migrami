import { SQLParsingError } from "pg-minify/lib/error.js";
import { DatabaseError } from "pg-protocol";

export function logDatabaseError(sql, error, highlightSql) {
  let lineNumber;
  const lines = sql.split("\n");
  if (error instanceof SQLParsingError) {
    lineNumber = error?.position?.line;
  } else {
    // DatabaseError
    lineNumber =
      (sql.substring(0, error.position).match(/\n/g) || []).length + 1;
  }
  console.error("");
  console.error(error.message, "on line", lineNumber);
  console.error("");

  const start = Math.max(0, lineNumber - 5);
  const end = Math.min(lines.length, lineNumber + 5);

  const highlightedLines = highlightSql(sql).split("\n");
  for (let i = start; i < end; i++) {
    let separator = i + 1 == lineNumber ? ">" : "|";
    separator = separator.padStart(
      1 + end.toString().length - (i + 1).toString().length
    );
    console.error(i + 1, separator, highlightedLines[i]);
  }
  console.error("");
}

export function withDatabaseError(callback) {
  return async (...args) => {
    try {
      return await callback(...args);
    } catch (error) {
      if (error instanceof DatabaseError) {
        logDatabaseError(args[0]);
      }
      throw error;
    }
  };
}
