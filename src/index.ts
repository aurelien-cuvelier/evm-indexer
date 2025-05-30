import { getConfig } from "./config";
import { EVMIndexer } from "./indexer";
import { globalLogger } from "./logger";
import { BACKEND_ID } from "./shared";

export const INDEXERS = [] as EVMIndexer[];

main();

setInterval(() => {
  const usage = process.memoryUsage();
  globalLogger.info(usage, "Memory Usage");
}, 60_000);

function main() {
  globalLogger.info("New instance started");

  const configs = getConfig();

  configs.forEach((config, i) => {
    const indexer = new EVMIndexer(config.name || `${BACKEND_ID}-${i}`, config);
    indexer.start();
    INDEXERS.push(indexer);
  });

  globalLogger.info(`Running ${INDEXERS.length} indexer(s)`);
}
