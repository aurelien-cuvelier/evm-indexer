import { IBasicModule } from "./basicModule";
import { EventLog } from "./eventsFetcher";

export interface LocalStorageManagerCache {
  //All these blocks shoud already be processed
  eventsLastBlock: string;
  transactionsLastBlock: string;
  internalTransactionsLastBlock: string;
}

export interface IStorageManager extends IBasicModule {
  eventsReceiver(events: EventLog[]): void;
  updateStorageCache(): void;
  getStorageCache(): LocalStorageManagerCache;
}
