import pino, { Logger } from "pino";
import { createPublicClient, http } from "viem";
import { Chain } from "viem/chains";
import { IndexerConfig } from "../configs/models";
import { LOGGER_CONFIG } from "../shared";
import { IInitializer } from "./interfaces/initializer";
import { Initializer } from "./modules/initializer";

export class EVMIndexer {
  private config: IndexerConfig;
  private chain: Chain | undefined;
  private initializer: IInitializer;
  private rpcs: string[] = [];
  private name: string;
  private logger: Logger;

  constructor(_name: string, _config: IndexerConfig) {
    this.name = _name;
    this.config = _config;
    this.logger = pino({
      ...LOGGER_CONFIG,
      base: { ...LOGGER_CONFIG.base, indexer: this.name },
    });
    this.initializer = new Initializer(this.logger, this.config);
  }

  async start() {
    const init = this.initializer.initialize();
    if (!init) {
      this.logger.warn(`Indexer is sleeping`);
      return;
    }
    this.rpcs = init.rpcs;
    this.chain = init.chain;
    this.logger.info(
      `Starting to work on chain #${this.config.chain_id} ${
        this.chain?.name ? `(${this.chain.name})` : ""
      } with ${this.rpcs.length} RPCs`
    );

    const client = createPublicClient({
      transport: http(this.rpcs[0]),
    });

    const b = await client.getBlockNumber();
    this.logger.info(`Last block: ${b}`);
  }
}
