import pino, { Logger } from "pino";
import { Chain } from "viem/chains";
import { IndexerConfig } from "../configs/models";
import { LOGGER_CONFIG } from "../shared";
import { IInitializer } from "./interfaces/initializer";
import { Initializer } from "./modules/initializer";

export class EVMIndexer {
  private config: IndexerConfig | undefined;
  private chain: Chain | undefined;
  private initializer: IInitializer;
  private rpcs: String[] = [];
  private name: string;
  private logger: Logger;

  constructor(_name: string, _configFile: string) {
    this.name = _name;
    this.logger = pino({
      ...LOGGER_CONFIG,
      base: { ...LOGGER_CONFIG.base, indexer: this.name },
    });
    this.initializer = new Initializer(this.logger, _configFile);
  }

  async start() {
    const init = this.initializer.initialize();
    if (!init) {
      this.logger.warn(`Indexer is sleeping`);
      return;
    }
    this.config = init.config;
    this.rpcs = init.rpcs;
    this.chain = init.chain;
    if (this.config.events) {
      this.logger.info(
        `Starting to work on chain #${this.config.chain_id} ${
          this.chain?.name ? `(${this.chain.name})` : ""
        } with ${this.rpcs.length} RPCs`
      );
    }
  }
}
