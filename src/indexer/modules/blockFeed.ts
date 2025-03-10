import { EventEmitter } from "events";
import { Logger } from "pino";
import { createPublicClient } from "viem";
import { IndexerConfig } from "../../configs/models";
import {
  BlockFeedEventEmitter,
  blockFeedEvents,
  IBlockFeed,
} from "../interfaces/blockFeed";

interface MinimalBlock {
  blockNumber: bigint;
  blockHash: `0x${string}`;
  parentHash: `0x${string}`;
}

export class BlockFeed implements IBlockFeed {
  moduleName = "BlockFeed";
  private _web3Client: ReturnType<typeof createPublicClient>;
  private _logger: Logger;
  private _config: IndexerConfig;
  private _lastTrustedBlockNumber = 0n; //The last safe block we know about, should include hash later
  private _highestChainBlockNumber = 0n;
  private _blockUpperLimit = 0n;
  private _initialized = false;
  private _eventEmitter!: BlockFeedEventEmitter;

  private _blockRecord = {} as Record<string, MinimalBlock>;
  private _blockHistory = [] as bigint[];

  constructor(
    config: IndexerConfig,
    logger: Logger,
    web3Client: typeof this._web3Client,
    lastTrustedBlockNumber: bigint,
    blockUpperLimit = 0n
  ) {
    this._config = config;
    this._logger = logger.child({ module: this.moduleName });
    this._web3Client = web3Client;
    /**
     * @TODO the trusted block should be the blockhash
     */
    this._lastTrustedBlockNumber = lastTrustedBlockNumber;
    this._blockUpperLimit = blockUpperLimit;
  }

  validateBlockHash(blockNumber: bigint, blockHash: `0x${string}`): boolean {
    const localBlockData = this._blockRecord[blockNumber.toString()];
    return (
      localBlockData.blockNumber === blockNumber &&
      localBlockData.blockHash === blockHash
    );
  }

  getBlockhashFromBlockNumber(blockNumber: bigint): `0x${string}` {
    return this._blockRecord[blockNumber.toString()].blockHash;
  }

  private async _getBlock(
    blockParam: { blockNumber: bigint } | { blockHash: `0x${string}` },
    includeTransactions = false
  ) {
    let err = 0;
    while (true) {
      try {
        const b = await this._web3Client.getBlock({
          includeTransactions,
          ...blockParam,
        });

        return b;
      } catch (e) {
        this._logger.error(
          e,
          `_getBlockNumber err #${err} block: ${
            "blockNumber" in blockParam
              ? blockParam.blockNumber.toLocaleString()
              : blockParam.blockHash
          }`
        );
        err++;

        await new Promise((r) => setTimeout(r, 1000 * (err + 1)));
      }
    }
  }

  getEventEmitter(): BlockFeedEventEmitter {
    return this._eventEmitter;
  }

  async initialize() {
    this._logger.debug("Initializing....");

    const lastTrustedBlock = await this._getBlock({
      blockNumber: this._lastTrustedBlockNumber,
    });

    this._blockHistory.push(lastTrustedBlock.number);
    this._blockRecord[lastTrustedBlock.number.toString()] = {
      blockNumber: lastTrustedBlock.number,
      blockHash: lastTrustedBlock.hash,
      parentHash: lastTrustedBlock.parentHash,
    };

    this._logger.debug(this._blockHistory, `initialize..`);

    this._eventEmitter = new EventEmitter() as BlockFeedEventEmitter;
    this._logger.debug(this._blockHistory, `Initialized`);
    this._logger.debug(this._blockRecord, `Initialized`);

    this._logger.debug(`Initialized`);
    this._initialized = true;
  }

  private async _findReorg(recentBlocks: bigint[]) {
    /**
     * @DEV
     * To find a reorg, we iterate over the recentBlocks from the end, and check that parent hashes match
     * with the previous element. If we arrive at our last block in memory with no hash mis-match, we then break.
     * Otherwise, a reorg happened and we continue to rollback until we find the block for which both chains converge.
     */
    let reorged = 0n;
    for (
      let blockNumber = recentBlocks[recentBlocks.length - 1];
      blockNumber > this._blockHistory[0];
      blockNumber--
    ) {
      if (
        this._blockRecord[blockNumber.toString()].parentHash ===
        this._blockRecord[(blockNumber - 1n).toString()].blockHash
      ) {
        if (blockNumber < this._blockHistory[this._blockHistory.length - 1]) {
          //this._logger.debug(`Last cached safe block: ${blockNumber - 1n}`);
          break;
        }

        continue;
      }

      /**
       * @DEV
       * If we come here then it means we found a reorg
       */

      const b = await this._getBlock({
        blockHash: this._blockRecord[blockNumber.toString()].parentHash,
      });

      this._logger.debug(
        `block #${b.number} (${
          this._blockRecord[b.number.toString()].blockHash
        }) reorged for ${b.hash}`
      );

      this._blockRecord[b.number.toString()] = {
        blockNumber: b.number,
        parentHash: b.parentHash,
        blockHash: b.hash,
      };

      reorged = b.number;
    }

    this._logger.debug(`No reorg detected in new blocks`);

    if (reorged) {
      this._eventEmitter.emit("message", {
        type: blockFeedEvents.REORG,
        lastUnsafeBlock: reorged,
      });
    }

    this._eventEmitter.emit("message", {
      type: blockFeedEvents.NEW_BLOCK,
      newSafeBlock: this._highestChainBlockNumber,
    });
    return false;
  }

  private async _fillNewBlocks() {
    const prms = [] as Promise<bigint>[];

    const clearPromises = async (): Promise<boolean> => {
      if (!prms.length) {
        return false;
      }
      const newUncheckedBlocks = await Promise.all(prms);
      prms.length = 0;

      const foundReorg = this._findReorg(newUncheckedBlocks);

      this._blockHistory.push(...newUncheckedBlocks);
      newUncheckedBlocks.length = 0;

      return false;
    };

    while (
      this._blockHistory[this._blockHistory.length - 1] <=
      this._highestChainBlockNumber
    ) {
      if (prms.length > 9) {
        const foundReorg = await clearPromises();
        if (foundReorg) {
          break;
        }
      }

      if (
        this._blockHistory[this._blockHistory.length - 1] +
          BigInt(prms.length + 1) >
        this._highestChainBlockNumber
      ) {
        break;
      }

      prms.push(
        new Promise<bigint>(async (r) => {
          const b = await this._getBlock({
            blockNumber:
              this._blockHistory[this._blockHistory.length - 1] +
              BigInt(prms.length + 1),
          });

          this._logger.debug(
            {
              blockNumber: b.number,
              blockHash: b.hash,
              parentHash: b.parentHash,
            },
            `Block: ${b.number.toLocaleString()}`
          );

          this._blockRecord[b.number.toString()] = {
            blockNumber: b.number,
            blockHash: b.hash,
            parentHash: b.parentHash,
          };
          r(b.number);
        })
      );
    }

    const foundReorg = await clearPromises();
  }

  private async _poll(): Promise<boolean> {
    const b = await this._web3Client.getBlockNumber();

    if (b === this._highestChainBlockNumber) {
      //Currently if we're on the same block we wait 1 sec before returning to avoid crazy loops
      await new Promise((r) => setTimeout(r, 1000));
      return false;
    }

    if (this._blockUpperLimit && b > this._blockUpperLimit) {
      this._highestChainBlockNumber = this._blockUpperLimit;
    } else {
      this._highestChainBlockNumber = b;
    }

    this._logger.debug(`New chain block: ${this._highestChainBlockNumber}`);
    await this._fillNewBlocks();

    return this._highestChainBlockNumber === this._blockUpperLimit;
  }

  async start() {
    if (!this._initialized) {
      this._logger.error(`Cannot start before initialization!`);
      return;
    }

    this._logger.info(`Starting...`);

    while (true) {
      const finishedWork = await this._poll();

      if (finishedWork) {
        return;
      }
    }
  }
}
