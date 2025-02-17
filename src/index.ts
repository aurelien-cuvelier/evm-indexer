import { getConfig } from "./config";
import { globalLogger } from "./logger";

main();

function main() {
  globalLogger.info("New instance started");
  const validatedConfig = getConfig();
}
