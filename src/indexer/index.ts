import { Logger } from "pino";
import { createPublicClient, http } from "viem";
import { Chain } from "viem/chains";
import { IndexerConfig } from "../configs/models";
import { globalLogger } from "../logger";
import { IBlockFeed } from "./interfaces/blockFeed";
import { IEventsFetcher } from "./interfaces/eventsFetcher";
import { IInitializer } from "./interfaces/initializer";
import { BlockFeed } from "./modules/blockFeed";
import { EventsFetcher } from "./modules/eventsFetcher";
import { Initializer } from "./modules/initializer";

export class EVMIndexer {
  private config: IndexerConfig;
  private chain: Chain | undefined;
  private rpcs: string[] = [];
  private name: string;
  private logger: Logger;
  private latestBlock = 0n;
  private web3Client!: ReturnType<typeof createPublicClient>;
  private indexerTasks: Promise<any>[] = [];

  //Mandatory modules
  private initializer: IInitializer;
  private _blockFeed!: IBlockFeed;

  //Optionnal modules
  private eventsFetcher!: IEventsFetcher;

  constructor(_name: string, _config: IndexerConfig) {
    //rpcDispenser has to be binded otherwise it will run in the wrong context if passed as arg
    this.rpcDispenser = this.rpcDispenser.bind(this);
    this.name = _name;
    this.config = _config;

    this.logger = globalLogger.child({ indexer: this.name });
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

    this.web3Client = createPublicClient({
      transport: http(this.rpcs[0]),
    });

    this._blockFeed = new BlockFeed(this.config, this.logger, this.web3Client);

    //A chain is not mandatory as it is still possible to index chain not existing in viem's data
    this.chain = init.chain;
  }

  rpcDispenser(): string {
    return this.rpcs[0];
  }

  async start() {
    if (!this.web3Client) {
      this.logger.error(
        `Indexer cannot be started as it is not correctly initialized`
      );
      return;
    }
    this.logger.info(
      `Starting to work on chain #${this.config.chainId} ${
        this.chain?.name ? `(${this.chain.name})` : ""
      } with ${this.rpcs.length} RPCs`
    );

    await this._blockFeed.initialize();

    if (this.config.events) {
      this.eventsFetcher = new EventsFetcher(
        this.logger,
        this.latestBlock,
        this.rpcDispenser
      );
      this.eventsFetcher.initialize(
        BigInt(
          this.config?.eventsOptions?.fromBlock || this.latestBlock - 100n
        ),
        BigInt(this.config?.eventsOptions?.toBlock || 0),
        10n
      );
      this.indexerTasks.push(this.eventsFetcher.start());
    }
    await Promise.all(this.indexerTasks);
    this.logger.warn(`Indexer is not running any task!`);
  }
}
