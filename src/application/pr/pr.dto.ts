import { z } from 'zod';

export const prLineSchema = z.object({
  variant_id: z.uuid(),
  quantity: z.number().positive(),
});

export const createPrSchema = z.object({
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  lines: z
    .array(prLineSchema)
    .min(1, 'A PR needs at least one line')
    .refine(
      (lines) => new Set(lines.map((l) => l.variant_id)).size === lines.length,
      'The same item variant appears twice; combine it into one line',
    ),
});

export type CreatePrDto = z.infer<typeof createPrSchema>;
