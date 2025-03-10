import fs from "fs";
import { Logger } from "pino";
import { IndexerConfig } from "../../configs/models";
import { localStorageManagerSchema } from "../../schemas";
import { EventLog } from "../interfaces/eventsFetcher";
import {
  IStorageManager,
  LocalStorageManagerCache,
} from "../interfaces/storageManager";

export class StorageManagerLocalFile implements IStorageManager {
  moduleName = "StorageManagerLocalFile";
  private _config: IndexerConfig;
  private _logger: Logger;
  private _cache: LocalStorageManagerCache;
  private _initialized = false;
  private _cacheFilePath: string;

  constructor(_logger: Logger, _config: IndexerConfig) {
    this._config = _config;
    this._logger = _logger.child({ module: this.moduleName });

    if (!fs.existsSync("./data")) {
      fs.mkdirSync("./data");
    }

    if (!fs.existsSync(`./data/${this._config.dirName}`)) {
      fs.mkdirSync(`./data/${this._config.dirName}`);
    }

    this._cacheFilePath = `./data/${this._config.dirName}/cache.json`;

    if (!fs.existsSync(this._cacheFilePath)) {
      fs.writeFileSync(
        this._cacheFilePath,
        JSON.stringify({
          eventsLastBlock: "0x0",
          transactionsLastBlock: "0x0",
          internalTransactionsLastBlock: "0x0",
        } as LocalStorageManagerCache)
      );
    }

    const unsafeCache = JSON.parse(
      String(fs.readFileSync(this._cacheFilePath))
    );

    const { data: safeCache, error } =
      localStorageManagerSchema.safeParse(unsafeCache);

    if (error) {
      this._logger.error(`Invalid cache data!`);
      throw new Error(`Invalid cache data!`);
    }

    this._cache = safeCache;

    if (
      this._config.events &&
      !fs.existsSync(`./data/${this._config.dirName}/events.json`)
    ) {
      fs.writeFileSync(`./data/${this._config.dirName}/events.json`, "");
    }

    /**
     * @TODO
     * Implement other files for other data types (internal, transactions)
     */

    this._initialized = true;
  }

  updateStorageCache() {
    fs.writeFileSync(
      this._cacheFilePath,
      JSON.stringify(this._cache, (_, value) => {
        if (typeof value === "bigint") {
          return value.toString(16);
        }

        return value;
      })
    );
  }

  getStorageCache() {
    return this._cache;
  }

  eventsReceiver(events: EventLog[]): void {}
}
