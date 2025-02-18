import { IBasicModule } from "./basicModule";

export interface EventLog {
  address: string;
  blockHash: string;
  blockNumber: string; //hex
  blockTimestamp: string; //hex
  data: string;
  logIndex: string; //hex
  removed: boolean;
  topics: string[];
  transactionHash: string;
  transactionIndex: string; //hex
}

export interface IEventsFetcher extends IBasicModule {
  initialize(
    startBlock: bigint,
    endBlock: bigint,
    blockIncrement: bigint,
    eventsReceiverCallback?: (events: EventLog[]) => Promise<void>
  ): void;
  newestCanonicalBlockUpdater(block: bigint): void;
  start(): Promise<void>;
}
