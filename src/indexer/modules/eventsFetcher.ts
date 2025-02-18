import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { Logger } from "pino";
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

  constructor(
    _logger: Logger,
    _newestCanonicalBlock: bigint,
    _rpcDispenser: typeof this.rpcDispenser
  ) {
    this.logger = _logger.child({ module: this.moduleName });
    this.newestCanonicalBlock = _newestCanonicalBlock;
    this.rpcDispenser = _rpcDispenser;
    this.workSynchronizer = new WorkSynchronizer(this.logger);
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
    this.eventsReceiverCallback = _eventsReceiverCallback;
    this.initialized = true;

    if (!this.eventsReceiverCallback) {
      this.logger.warn(
        `The event fetcher was not initialized with a callback for fetched events, therefore they will remain unprocessed.`
      );
    }

    return;
  }

  newestCanonicalBlockUpdater() {}

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

      const iterationFromBlock = this.startBlock;
      const iterationToBlock =
        this.startBlock + this.blockIncrement > this.newestCanonicalBlock
          ? this.newestCanonicalBlock
          : this.startBlock + this.blockIncrement;

      if (iterationFromBlock > this.newestCanonicalBlock) {
        this.workSynchronizer.pauseWork(
          WorkSynchronizerPauseReasons.WAITING_NEW_CANONICAL_BLOCK
        );
        return [];
      }

      const res = await axios.post<{ result: EventLog[] }>(
        this.rpcDispenser(),
        {
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
        this.logger.debug(res.data, "Received weird response");
      }
      this.logger.info(
        `Received ${
          res.data.result.length
        } events in range ${iterationFromBlock.toLocaleString()} - ${iterationToBlock.toLocaleString()}`
      );

      this.startBlock += this.blockIncrement + 1n;

      return res.data.result;
    } catch (e: unknown) {
      this.logger.error(e, `Error during fetch`);
      return [];
    }
  }

  async start() {
    this.logger.info(`Event fetcher is starting to work...`);
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
