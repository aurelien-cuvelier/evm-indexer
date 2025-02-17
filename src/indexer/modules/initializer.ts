import { Logger } from "pino";
import * as chains from "viem/chains";
import { getConfig } from "../../config";
import { IInitializer } from "../interfaces/initializer";

export class Initializer implements IInitializer {
  private configName: string;
  private logger: Logger;

  constructor(_logger: Logger, _configName: string) {
    this.configName = _configName;
    this.logger = _logger;
  }
  initialize() {
    try {
      const config = getConfig(this.logger, this.configName);
      if (!config) {
        throw new Error(`Could not initialize`);
      }
      const chain = Object.values(chains).find(
        (viemChain) => viemChain.id === config.chain_id
      );

      if (!chain?.rpcUrls?.default?.http?.length) {
        this.logger.fatal(
          `Could not find RPC for chain id #${config.chain_id}. Check that it is valid or add your own RPCs in the config file. Exiting process...`
        );
        process.exit(1);
      }

      return { config, rpcs: [...chain.rpcUrls.default.http], chain };
    } catch (e: unknown) {
      this.logger.error(e, `Error during initialization`);
      return null;
    }
  }
}
