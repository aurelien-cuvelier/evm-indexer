import { IBasicModule } from "./basicModule";
import { IStorageManager } from "./storageManager";

export interface EventLog {
  address: string;
  blockHash: `0x${string}`;
  blockNumber: `0x${string}`;
  blockTimestamp: `0x${string}`;
  data: string;
  logIndex: `0x${string}`;
  removed: boolean;
  topics: string[];
  transactionHash: string;
  transactionIndex: `0x${string}`;
}

export interface IEventsFetcher extends IBasicModule {
  initialize(
    startBlock: bigint,
    endBlock: bigint,
    blockIncrement: bigint,
    dataReceiverCallback?: IStorageManager["dataReceiver"]
  ): void;
  start(): Promise<void>;
}
