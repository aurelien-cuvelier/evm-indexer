/**
 * The config file should be an array of IndexerConfig objects, allowing easy scaling if you wanna run multiple
 * indexers within the same thread. All indexers are independent from eachothers.
 */

export interface IndexerConfig {
  chain_id: number;
  events: boolean;
  name?: string;
  from_block?: number;
  to_block?: number;
  rpcs?: string[];
}
