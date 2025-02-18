import z from "zod";
import { IndexerConfig } from "./configs/models";

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
  })
  .array();
