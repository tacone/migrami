import * as chokidar from "chokidar";

export function watchFile(
  location,
  handler,
  { events = ["add", "change", "unlink"] }
) {
  const watcher = chokidar.watch(location, {
    usePolling: true,
    awaitWriteFinish: {
      stabilityThreshold: 150,
      pollInterval: 50,
    },
    ignoreInitial: true,
  });

  for (const e of events) {
    watcher.on(e, handler);
  }
}
