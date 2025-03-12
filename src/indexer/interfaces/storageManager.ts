import { MinimalBlock } from "../modules/blockFeed";
import { IBasicModule } from "./basicModule";
import { EventLog } from "./eventsFetcher";

interface BlockCache {
  blockNumber: bigint;
  blockHash: `0x${string}`;
}

export interface StorageManagerCache {
  //All these blocks shoud already be processed
  eventsLastBlock: BlockCache;
  transactionsLastBlock: BlockCache;
  internalTransactionsLastBlock: BlockCache;
}

type DataReceiverPayload =
  | { type: "events"; data: EventLog[] }
  | { type: "blocks"; data: MinimalBlock[] };

export interface IStorageManager extends IBasicModule {
  dataReceiver(payload: DataReceiverPayload): Promise<void>;
  updateStorageCache(): void;
  getStorageCache(): StorageManagerCache;
  closeAllStream(): void;
}
