import { LoggerOptions } from "pino";
import * as genShortUUID from "short-uuid";

const BACKEND_ID = genShortUUID.generate();

export const LOGGER_CONFIG: LoggerOptions = {
  base: {
    backend_id: BACKEND_ID,
  },
  customLevels: {
    fatal: 80,
  },
};
