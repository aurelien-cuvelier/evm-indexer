import { Logger } from "pino";
import * as chains from "viem/chains";
import { IndexerConfig } from "../../configs/models";
import { IInitializer } from "../interfaces/initializer";

export class Initializer implements IInitializer {
  private config: IndexerConfig;
  private logger: Logger;

  constructor(_logger: Logger, _config: IndexerConfig) {
    this.config = _config;
    this.logger = _logger;
  }
  initialize() {
    try {
      const chain = Object.values(chains).find(
        (viemChain) => viemChain.id === this.config.chain_id
      );
      const rpcs = [] as string[];

      if (this.config.rpcs) {
        rpcs.push(...this.config.rpcs);
      }

      if (chain?.rpcUrls?.default?.http?.length) {
        rpcs.push(...chain.rpcUrls.default.http);
      }

      if (rpcs.length === 0) {
        this.logger.fatal(
          `Could not find RPC for chain id #${this.config.chain_id}. Check that it is valid or add your own RPCs in the config file.`
        );
        return null;
      }

      return { rpcs: rpcs.filter((rpc, i) => i === rpcs.indexOf(rpc)), chain };
    } catch (e: unknown) {
      this.logger.error(e, `Error during initialization`);
      return null;
    }
  }
}
