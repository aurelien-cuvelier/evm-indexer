import fs from "fs";
import { Logger } from "pino";
import { IndexerConfig } from "./configs/models";
import { indexerConfigSchema } from "./schemas";

export function getConfig(logger: Logger, name: string): IndexerConfig | null {
  if (!name.includes(".json")) {
    name += ".json";
  }
  const filePath = `src/configs/${name}`;
  if (!fs.existsSync(filePath)) {
    logger.error(`Config file "${name}" in "configs/" not found!`);
    return null;
  }

  try {
    const loadedConfig = JSON.parse(String(fs.readFileSync(filePath)));
    const { data: indexerConfig, error } =
      indexerConfigSchema.safeParse(loadedConfig);

    if (error) {
      logger.error(`Config file "${name}" is invalid!`);
      return null;
    }

    logger.info({ indexerConfig }, `Loaded config file "${name}"`);
    return indexerConfig;
  } catch (e) {
    logger.error(`Config file "${name}" contains invalid json!`);
  }
  return null;
}
