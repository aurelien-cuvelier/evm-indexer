import { getConfig } from "./config";
import { EVMIndexer } from "./indexer";
import { IStorageManager } from "./indexer/interfaces/storageManager";
import { JsonFileAppendor } from "./jsonFileAppend";
import { globalLogger } from "./logger";
import { BACKEND_ID } from "./shared";

export const INDEXERS = [] as EVMIndexer[];

main();

setInterval(() => {
  const usage = process.memoryUsage();
  globalLogger.info(usage, "Memory Usage");
}, 60_000);

async function main() {
  const filePath = `./data/chadexer-data/events.json`;

  const jsa = new JsonFileAppendor<
    Parameters<IStorageManager["dataReceiver"]>[0]["data"][number]
  >(filePath);

  jsa.rollback2("blockNumber", (value) => {
    console.log(
      `BigInt(${value}) >= BigInt(0x15155c9): ${
        BigInt(value) >= BigInt(0x15155c9)
      }`
    );
    return BigInt(value) >= BigInt(0x15155c9);
  });

  // jsa.rollback("blockHash", (value) => {
  //   return (
  //     value !==
  //     "0xde03872e5d3fd49b49fad355311a1a488713efdb4a880bf5503f7d92bb8f69af"
  //   );
  // });

  return;
  globalLogger.info("New instance started");

  const configs = getConfig();

  configs.forEach((config, i) => {
    const indexer = new EVMIndexer(config.name || `${BACKEND_ID}-${i}`, config);
    indexer.start();
    INDEXERS.push(indexer);
  });

  globalLogger.info(`Running ${INDEXERS.length} indexer(s)`);
}
