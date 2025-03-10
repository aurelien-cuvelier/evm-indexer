/**
 * The config file should be an array of IndexerConfig objects, allowing easy scaling if you wanna run multiple
 * indexers within the same thread. All indexers are independent from eachothers.
 */

export interface IndexerConfig {
  chainId: number;
  events: boolean;
  eventsOptions?: EventsOptions;
  name?: string;
  rpcs?: string[];
  storageType: "file";
  dirName: string;
}

interface EventsOptions {
  fromBlock?: number;
  toBlock?: number;
}
