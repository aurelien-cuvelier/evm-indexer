import z from "zod";
import { IndexerConfig } from "./configs/models";

export const indexerConfigSchema: z.ZodType<IndexerConfig> = z.object({
  chain_id: z.number(),
  events: z.boolean(),
  rpcs: z.array(z.string()).optional(),
});
