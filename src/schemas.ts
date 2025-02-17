import z from "zod";
import { IndexerConfig } from "./configs/models";

export const indexerConfigSchema: z.ZodType<IndexerConfig[]> = z
  .object({
    chain_id: z.number(),
    events: z.boolean(),
    name: z.string().optional(),
    from_block: z.number().optional(),
    to_block: z.number().optional(),
    rpcs: z.array(z.string()).optional(),
  })
  .array();
