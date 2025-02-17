import fs from "fs";
import { IndexerConfig } from "./configs/models";
import { globalLogger } from "./logger";
import { indexerConfigSchema } from "./schemas";

export function getConfig(name = "default"): IndexerConfig {
  if (!name.includes(".json")) {
    name += ".json";
  }
  const filePath = `src/configs/${name}`;
  if (!fs.existsSync(filePath)) {
    globalLogger.fatal(
      `Config file "${name}" in "configs/" not found! Exiting process...`
    );
    process.exit(1);
  }

  try {
    const loadedConfig = JSON.parse(String(fs.readFileSync(filePath)));
    const { data: indexerConfig, error } =
      indexerConfigSchema.safeParse(loadedConfig);

    if (error) {
      globalLogger.fatal(
        `Config file "${name}" is invalid! Exiting process...`
      );
      process.exit(1);
    }

    globalLogger.info({ indexerConfig }, `Loaded config file "${name}"`);
    return indexerConfig;
  } catch (e) {
    globalLogger.fatal(
      `Config file "${name}" contains invalid json! Exiting process...`
    );
    process.exit(1);
  }
}
