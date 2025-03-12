import fs from "fs";
import { Logger } from "pino";
import { IndexerConfig } from "../../configs/models";
import { JsonFileAppendor } from "../../jsonFileAppend";
import { StorageManagerCacheSchema } from "../../schemas";
import { EventLog } from "../interfaces/eventsFetcher";
import {
  IStorageManager,
  StorageManagerCache,
} from "../interfaces/storageManager";
import { MinimalBlock } from "./blockFeed";

export class StorageManagerLocalFile implements IStorageManager {
  moduleName = "StorageManagerLocalFile";
  private _config: IndexerConfig;
  private _logger: Logger;
  private _cache: StorageManagerCache;
  private _initialized = false;
  private _cacheFilePath: string;

  private _blockFeedFilePath: string;
  private _blockFeedWriter: JsonFileAppendor<MinimalBlock>;

  private _eventsFilePath: string;
  private _eventsWriter: JsonFileAppendor<EventLog>;

  constructor(logger: Logger, config: IndexerConfig) {
    this._config = config;
    this._logger = logger.child({ module: this.moduleName });
    if (!fs.existsSync("./data")) {
      fs.mkdirSync("./data");
    }

    if (!fs.existsSync(`./data/${this._config.dirName}`)) {
      fs.mkdirSync(`./data/${this._config.dirName}`);
    }

    this._cacheFilePath = `./data/${this._config.dirName}/cache.json`;

    if (!fs.existsSync(this._cacheFilePath)) {
      fs.writeFileSync(this._cacheFilePath, this._getNewStringifiedCache());
    }

    const unsafeCache = JSON.parse(
      String(fs.readFileSync(this._cacheFilePath))
    );

    const { data: safeCache, error } =
      StorageManagerCacheSchema.safeParse(unsafeCache);

    if (error) {
      this._logger.error(`Invalid cache data!`);
      throw new Error(`Invalid cache data!`);
    }

    this._cache = safeCache;

    this._logger.debug(this._cache, `Loaded cache`);

    //====BlockFeed File
    this._blockFeedFilePath = `./data/${this._config.dirName}/blocksFeed.json`;
    this._blockFeedWriter = new JsonFileAppendor(this._blockFeedFilePath);
    //================

    //====Events File
    this._eventsFilePath = `./data/${this._config.dirName}/events.json`;
    this._eventsWriter = new JsonFileAppendor(this._eventsFilePath);
    //================

    /**
     * @TODO
     * Implement other files for other data types (internal, transactions)
     */

    this._logger.info(`Initialized`);
    this._initialized = true;
  }

  updateStorageCache() {
    fs.writeFileSync(this._cacheFilePath, this._stringifier(this._cache));
  }

  private _stringifier(data: object): string {
    return JSON.stringify(data, (_, value) => {
      if (typeof value === "bigint") {
        return "0x" + value.toString(16);
      }

      return value;
    });
  }

  getStorageCache() {
    return this._cache;
  }

  async dataReceiver(
    payload: Parameters<IStorageManager["dataReceiver"]>[0]
  ): Promise<void> {
    /**
     * @DEV
     * We make this method async even tho there is no async operation going on here,
     * as some other type of storage might require async to be consistent
     */
    if (!this._initialized) {
      this._logger.error(`Cannot start without being initialized!`);
      return;
    }

    if (payload.type === "events") {
      this._eventsWriter.writeSync(payload.data);

      this._cache.eventsLastBlock.blockNumber = BigInt(
        payload.data[payload.data.length - 1].blockNumber
      );
      this._cache.eventsLastBlock.blockHash =
        payload.data[payload.data.length - 1].blockHash;
    } else if (payload.type === "blocks") {
      this._blockFeedWriter.writeSync(payload.data);
    }

    this._updateCache();
  }

  closeAllStream() {
    // if (this._eventWriteStream) {
    //   this._eventWriteStream.close();
    // }
  }

  private _updateCache(): void {
    fs.writeFileSync(this._cacheFilePath, this._stringifier(this._cache));
  }

  private _getNewStringifiedCache(): string {
    return this._stringifier({
      eventsLastBlock: {
        blockHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        blockNumber: 0n,
      },
      transactionsLastBlock: {
        blockHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        blockNumber: 0n,
      },
      internalTransactionsLastBlock: {
        blockHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        blockNumber: 0n,
      },
    } as StorageManagerCache);
  }
}
