import { EVMIndexer } from "./indexer";
import { globalLogger } from "./logger";

main();

function main() {
  globalLogger.info("New instance started");
  const indexer = new EVMIndexer("Chadexer", "default");
  indexer.start();
}
