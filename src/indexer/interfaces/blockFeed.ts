import { IBasicModule } from "./basicModule";

export interface IBlockFeed extends IBasicModule {
  initialize(): Promise<void>;
  start(): Promise<void>;
}
