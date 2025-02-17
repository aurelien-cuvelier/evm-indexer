import { Chain } from "viem/chains";

export interface IInitializer {
  initialize(): { rpcs: string[]; chain: Chain | undefined } | null;
}
