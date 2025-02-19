import { Logger } from "pino";
import { createPublicClient } from "viem";
import { IndexerConfig } from "../../configs/models";
import { IBlockFeed } from "../interfaces/blockFeed";

export class BlockFeed implements IBlockFeed {
  moduleName = "BlockTrailer";
  private _web3Client: ReturnType<typeof createPublicClient>;
  private _logger: Logger;
  private _config: IndexerConfig;
  private _highestChainBlock!: bigint;
  private _initialized = false;
  private _blockTrailLength: number;
  /**
   * @DEV
   *_blockTrail contains blocks in the decreasing order, the latest block being elem[0]
   */
  private _blockRecord = {} as Record<
    string,
    {
      blockNumber: bigint;
      blockHash: string;
      parentHash: string;
    }
  >;
  private _blockTrail: BigInt[];

  constructor(
    config: IndexerConfig,
    logger: Logger,
    web3Client: typeof this._web3Client
  ) {
    this._config = config;
    this._logger = logger.child({ module: this.moduleName });
    this._web3Client = web3Client;
    /**
     * @TODO
     * Add config prop to adjust the trail length
     */
    this._blockTrailLength = 10;
    this._blockTrail = new Array(this._blockTrailLength).fill(null);
  }

  async initialize() {
    this._logger.debug("Initializing....");
    this._highestChainBlock = await this._web3Client.getBlockNumber();
    this._logger.debug(`Highest block: ${this._highestChainBlock}`);

    const initPromises = [] as Promise<any>[];
    this._blockTrail.forEach((_, i) => {
      initPromises.push(
        new Promise(async (r) => {
          const b = await this._web3Client.getBlock({
            includeTransactions: false,
            blockNumber:
              this._highestChainBlock -
              BigInt(this._blockTrailLength) +
              BigInt(i + 1),
          });

          this._blockTrail[i] = b.number;

          this._blockRecord[b.number.toString()] = {
            blockNumber: b.number,
            blockHash: b.hash,
            parentHash: b.parentHash,
          };
          r(null);
        })
      );
    });

    await Promise.all(initPromises);
    //this._logger.debug(this._blockTrail, `Initialized`);
    this._logger.debug(`Initialized`);
    this._initialized = true;
  }

  async poll() {
    const b = await this._web3Client.getBlockNumber();

    if (b === this._blockTrail[this._blockTrail.length - 1]) {
      //Currently if we're on the same block we wait 1 sec before returning to avoid crazy loops
      await new Promise((r) => setTimeout(r, 1000));
      return;
    }


  }

  async start() {
    if (!this._initialized) {
      this._logger.error(`Cannot start before initialization!`);
      return;
    }

    this._logger.info(`Starting...`);
  }
}
