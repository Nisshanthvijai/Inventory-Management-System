import { z } from 'zod';

/** Sets the absolute quantity, in the STOCK unit (e.g. after a stock count). */
export const setStockSchema = z.strictObject({
  quantity: z.number().min(0),
});

export type SetStockDto = z.infer<typeof setStockSchema>;
