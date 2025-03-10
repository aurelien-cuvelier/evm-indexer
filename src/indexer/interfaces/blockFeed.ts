import TypedEmitter from "typed-emitter";

import { IBasicModule } from "./basicModule";

export enum blockFeedEvents {
  NEW_BLOCK = "NEW_BLOCK",
  REORG = "REORG",
}

type BlockFeedEventsType = {
  error: (error: Error) => void;
  message: (
    body:
      | { type: blockFeedEvents.NEW_BLOCK; newSafeBlock: bigint }
      | { type: blockFeedEvents.REORG; lastUnsafeBlock: bigint }
  ) => void;
};

export type BlockFeedEventEmitter = TypedEmitter<BlockFeedEventsType>;

export interface IBlockFeed extends IBasicModule {
  initialize(): Promise<void>;
  start(): Promise<void>;
  getEventEmitter(): BlockFeedEventEmitter;
  validateBlockHash(blockNumber: bigint, blockHash: `0x${string}`): boolean;
  getBlockhashFromBlockNumber(blockNumber: bigint): `0x${string}`;
}
