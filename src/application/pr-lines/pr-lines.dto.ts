import { z } from 'zod';

/** A manager's decision on one PR line: accept (with a quantity) or reject (with a comment). */
export const decideLineSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('accepted'),
    approved_quantity: z.number().positive(),
  }),
  z.strictObject({
    status: z.literal('rejected'),
    rejection_comment: z.string().trim().min(1, 'A rejection needs a comment'),
  }),
]);

export type DecideLineDto = z.infer<typeof decideLineSchema>;
