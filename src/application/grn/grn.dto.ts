import { z } from 'zod';

// Quantities are in the PURCHASE unit (the unit the PO was written in).
export const grnLineSchema = z.strictObject({
  po_line_id: z.uuid(),
  variant_id: z.uuid(), // the PO line's variant, or a different one (a substitute)
  received_quantity: z.number().positive(),
  completes_line: z.boolean().default(false),
});

export const createGrnSchema = z.strictObject({
  po_id: z.uuid(),
  invoice_no: z.string().trim().min(1, 'An invoice number is required'),
  invoice_date: z.iso.date().optional(),
  received_date: z.iso.date().optional(),
  comments: z.string().trim().min(1).optional(),
  lines: z
    .array(grnLineSchema)
    .min(1, 'A GRN needs at least one line')
    .refine(
      (lines) => new Set(lines.map((l) => l.po_line_id)).size === lines.length,
      'The same PO line appears twice; combine it into one line',
    ),
});

export type CreateGrnDto = z.infer<typeof createGrnSchema>;
