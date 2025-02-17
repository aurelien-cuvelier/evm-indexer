import { Chain } from "viem/chains";
import { IndexerConfig } from "../../configs/models";

export interface IInitializer {
  initialize(): { config: IndexerConfig; rpcs: string[]; chain: Chain } | null;
}
