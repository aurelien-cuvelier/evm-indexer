import { Chain } from "viem/chains";
import { IBasicModule } from "./basicModule";

export interface IInitializer extends IBasicModule {
  initialize(): { rpcs: string[]; chain: Chain | undefined } | null;
}
