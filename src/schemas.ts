import z from "zod";
import { IndexerConfig } from "./configs/models";
import { StorageManagerCache } from "./indexer/interfaces/storageManager";

const zod256BitsHashHex = z
  .string()
  .regex(
    /^0x[a-fA-F0-9]{64}$/,
    "Must be a valid 256-bit hexadecimal string starting with 0x"
  )
  .refine((val) => val.length === 66, {
    message: "Must be exactly 256 bits (64 hex chars + 0x prefix)",
  });

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
 * @DEV Cache for storage manager
 */

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

const BlockCacheSchema: z.ZodType<
  StorageManagerCache[keyof StorageManagerCache]
> = z.object({
  blockHash: zod256BitsHashHex as z.ZodType<`0x${string}`>,
  blockNumber: zodBigint as unknown as z.ZodBigInt,
});

export const StorageManagerCacheSchema: z.ZodType<StorageManagerCache> =
  z.object({
    eventsLastBlock: BlockCacheSchema,
    transactionsLastBlock: BlockCacheSchema,
    internalTransactionsLastBlock: BlockCacheSchema,
  });
