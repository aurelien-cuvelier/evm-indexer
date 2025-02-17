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
  private latestBlock = 0n;
  private client: ReturnType<typeof createPublicClient> | undefined;

  constructor(_name: string, _config: IndexerConfig) {
    this.name = _name;
    this.config = _config;
    this.logger = pino({
      ...LOGGER_CONFIG,
      base: { ...LOGGER_CONFIG.base, indexer: this.name },
    });
    this.initializer = new Initializer(this.logger, this.config);

    const init = this.initializer.initialize();
    if (!init) {
      this.logger.error(`Could not initialize the indexer`);
      return;
    }

    //RPCs from the initializer are already aggregated with config and de-duplicated
    this.rpcs = init.rpcs;

    if (this.rpcs.length === 0) {
      this.logger.error(`An indexer cannot be initialized with 0 RPC`);
      return;
    }

    this.client = createPublicClient({
      transport: http(this.rpcs[0]),
    });

    //A chain is not mandatory as it is still possible to index chain not existing in viem's data
    this.chain = init.chain;
  }

  async start() {
    if (!this.client) {
      this.logger.error(
        `Indexer cannot be started as it is not correctly initialized`
      );
      return;
    }
    this.logger.info(
      `Starting to work on chain #${this.config.chain_id} ${
        this.chain?.name ? `(${this.chain.name})` : ""
      } with ${this.rpcs.length} RPCs`
    );

    this.latestBlock = await this.client.getBlockNumber();
    this.logger.info(`Last block: ${this.latestBlock}`);
  }
}
