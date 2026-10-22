import { z } from 'zod';

// strictObject: a stray `variant_id` (a substitute item) is a 400, not silently ignored.
export const poLineSchema = z.strictObject({
  pr_line_id: z.uuid(),
  price: z.number().min(0),
  quantity: z.number().positive(),
  gst: z.number().min(0).max(100).default(0),
  arrival_date: z.iso.date().optional(),
});

export const createPoSchema = z.strictObject({
  vendor_id: z.uuid(),
  po_date: z.iso.date().optional(),
  payment_terms: z.string().trim().min(1).optional(),
  comments: z.string().trim().min(1).optional(),
  lines: z
    .array(poLineSchema)
    .min(1, 'A PO needs at least one line')
    .refine(
      (lines) => new Set(lines.map((l) => l.pr_line_id)).size === lines.length,
      'The same PR line appears twice; combine it into one line',
    ),
});

export type CreatePoDto = z.infer<typeof createPoSchema>;
