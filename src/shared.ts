import { LoggerOptions } from "pino";
import * as genShortUUID from "short-uuid";

export const BACKEND_ID = genShortUUID.generate();

export const LOGGER_CONFIG: LoggerOptions = {
  base: {
    backend_id: BACKEND_ID,
  },
  level:'debug',
  customLevels: {
    fatal: 80,
  },
};
