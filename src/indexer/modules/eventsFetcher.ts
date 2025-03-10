import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { Logger } from "pino";
import {
  BlockFeedEventEmitter,
  blockFeedEvents,
  IBlockFeed,
} from "../interfaces/blockFeed";
import { EventLog, IEventsFetcher } from "../interfaces/eventsFetcher";
import {
  IWorkSynchronizer,
  WorkSynchronizerPauseReasons,
} from "../interfaces/workSynchronizer";
import { WorkSynchronizer } from "./workSynchronizer";

export class EventsFetcher implements IEventsFetcher {
  moduleName = "EventsFetcher";
  private startBlock = 0n;
  private endBlock = 0n;
  private blockIncrement = 0n;
  private logger: Logger;
  private initialized = false;
  private rpcDispenser: () => string;
  private eventsReceiverCallback?: (events: EventLog[]) => Promise<void>;
  private newestCanonicalBlock = 0n;
  private workSynchronizer: IWorkSynchronizer;
  blockFeed: IBlockFeed;
  private _blockFeedEmitter: BlockFeedEventEmitter;

  //Used reduce block increment if needed
  private _lastFetchFailed = false;

  constructor(
    _logger: Logger,
    _newestCanonicalBlock: bigint,
    _rpcDispenser: typeof this.rpcDispenser,
    _blockFeed: IBlockFeed
  ) {
    this.logger = _logger.child({ module: this.moduleName });
    this.newestCanonicalBlock = _newestCanonicalBlock;
    this.rpcDispenser = _rpcDispenser;
    this.workSynchronizer = new WorkSynchronizer(this.logger);
    this.blockFeed = _blockFeed;
    this._blockFeedEmitter = this.blockFeed.getEventEmitter();
  }

  initialize(
    _startBlock: bigint,
    _endBlock: bigint,
    _blockIncrement: bigint,
    _eventsReceiverCallback: typeof this.eventsReceiverCallback
  ) {
    this.startBlock = _startBlock;
    this.endBlock = _endBlock;
    this.blockIncrement = _blockIncrement;
    this.initialized = true;

    if (!this.eventsReceiverCallback) {
      this.logger.warn(
        `The event fetcher was not initialized with a callback for fetched events, therefore they will remain unprocessed.`
      );
    }

    return;
  }

  private async fetch() {
    try {
      if (!this.initialized) {
        this.logger.error(
          `Cannot fetch events as eventFetcher is NOT initialized!`
        );
        return [];
      }
      /**
       * @DEV
       * We use axios to fetch events instead of a web3 lib to keep full control & flexibility
       */

      const iterationBlockIncrement = this._lastFetchFailed
        ? 1n
        : this.blockIncrement;

      const iterationFromBlock = this.startBlock;
      const iterationToBlock =
        this.startBlock + iterationBlockIncrement > this.newestCanonicalBlock
          ? this.newestCanonicalBlock
          : this.startBlock + iterationBlockIncrement;

      if (iterationFromBlock > this.newestCanonicalBlock) {
        this.logger.debug(
          iterationFromBlock > this.newestCanonicalBlock,
          `iterationFromBlock (${iterationFromBlock}) > this.newestCanonicalBlock (${this.newestCanonicalBlock})`
        );
        this.workSynchronizer.pauseWork(
          WorkSynchronizerPauseReasons.WAITING_NEW_CANONICAL_BLOCK
        );
        return [];
      } else {
        this.logger.debug(
          iterationFromBlock > this.newestCanonicalBlock,
          `iterationFromBlock (${iterationFromBlock}) > this.newestCanonicalBlock (${this.newestCanonicalBlock})`
        );
      }

      const res = await axios.post<{ result: EventLog[] }>(
        this.rpcDispenser(),
        {
          /**
           * @TODO
           * If fromBlock=toBlock then we can use blockHash instead so that we don't need to filter later
           */
          method: "eth_getLogs",
          params: [
            {
              fromBlock: "0x" + iterationFromBlock.toString(16),
              toBlock: "0x" + iterationToBlock.toString(16),
              //   address: "0x",
              //   topics: [
              //     "0x",
              //   ],
            },
          ],
          id: 1,
          jsonrpc: "2.0",
        }
      );
      this.logger.debug(
        `requesting ${iterationFromBlock.toLocaleString()} - ${iterationToBlock.toLocaleString()}`
      );
      this.logger.debug(`response code ${res.status}`);

      if (res.status !== StatusCodes.OK) {
        return [];
      }

      if (typeof res.data.result?.length !== "number") {
        this.logger.debug(
          res.data,
          "Received unexpected reponse, reducing block increment..."
        );
        throw new Error(
          `Received unexpected reponse, reducing block increment...`
        );
      }

      for (const event of res.data.result) {
        const validBlock = this.blockFeed.validateBlockHash(
          BigInt(event.blockNumber),
          event.blockHash as `0x${string}`
        );

        if (!validBlock) {
          /**
           * If we receive an invalid block hash here then it means the block we queried from might not be fully
           * in sync. So in that case it is better to repeat this iteration to give it time to resync or query
           * a different node in case of multi RPCs config
           */
          throw new Error(`Non matching blockhash`);
        }
      }

      this._lastFetchFailed = false;

      this.logger.info(
        `Received ${
          res.data.result.length
        } events in range ${iterationFromBlock.toLocaleString()} - ${iterationToBlock.toLocaleString()}`
      );

      this.startBlock = iterationToBlock + 1n;

      return res.data.result;
    } catch (e: unknown) {
      this.logger.error(e, `Error during fetch`);
      this._lastFetchFailed = true;
      await new Promise((r) => setTimeout(r, 1000));
      return [];
    }
  }

  async start() {
    this.logger.info(`Event fetcher is starting to work...`);

    this._blockFeedEmitter.on("message", (data) => {
      this.logger.debug(data, `Received data from emitter`);

      if (data.type === blockFeedEvents.NEW_BLOCK) {
        this.newestCanonicalBlock = data.newSafeBlock;

        if (!this.workSynchronizer.paused) {
          return;
        }

        if (
          this.workSynchronizer.pauseReason ===
          WorkSynchronizerPauseReasons.WAITING_NEW_CANONICAL_BLOCK
        ) {
          this.workSynchronizer.resumeWork();
        }
      } else if (data.type === blockFeedEvents.REORG) {
        /**
         * @TODO Untested
         * If the worker is paused for another reason we change the reason as we don't want another
         * operation to resume work while we're still working on the reorg cleaning
         */
        const workSyncSelector = this.workSynchronizer.paused
          ? this.workSynchronizer.changePauseReason
          : this.workSynchronizer.pauseWork;

        workSyncSelector(
          WorkSynchronizerPauseReasons.WAITING_FOR_REORG_WORK_TO_END
        );

        //await for function that will handle reorg on the storage level...
        this.newestCanonicalBlock = data.lastUnsafeBlock;
        this.workSynchronizer.resumeWork();
      }
    });

    while (true) {
      if (this.endBlock && this.startBlock > this.endBlock) {
        //If the config has an endBlock then we stop work without trailing
        break;
      }

      if (this.workSynchronizer.paused) {
        await this.workSynchronizer.pausePromise;
      }

      const events = await this.fetch();
      if (this.eventsReceiverCallback) {
        await this.eventsReceiverCallback(events);
      }
    }
    this.logger.info(`Event fetcher finished all the work`);

    return;
  }
}
