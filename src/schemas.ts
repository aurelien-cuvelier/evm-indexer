import z from "zod";
import { IndexerConfig } from "./configs/models";
import { LocalStorageManagerCache } from "./indexer/interfaces/storageManager";

const zodBigint = z.string().refine(
  (val) => {
    try {
      BigInt(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid bigint value" }
);

/**
 * @DEV Indexer Config
 */
const eventsOptionsSchema: z.ZodType<IndexerConfig["eventsOptions"]> = z
  .object({
    fromBlock: z.number().optional(),
    toBlock: z.number().optional(),
  })
  .optional();

export const indexerConfigSchema: z.ZodType<IndexerConfig[]> = z
  .object({
    chainId: z.number(),
    events: z.boolean(),
    eventsOptions: eventsOptionsSchema,
    name: z.string().optional(),
    rpcs: z.array(z.string()).optional(),
    storageType: z.literal("file"),
    dirName: z.string(),
  })
  .array();

/**
 * @DEV Cache for local file storage manager
 */

export const localStorageManagerSchema: z.ZodType<LocalStorageManagerCache> =
  z.object({
    eventsLastBlock: zodBigint,
    transactionsLastBlock: zodBigint,
    internalTransactionsLastBlock: zodBigint,
  });
