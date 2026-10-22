import { z } from 'zod';

export const updateUserSchema = z
  .strictObject({
    full_name: z.string().trim().min(1).optional(),
    role: z.enum(['admin', 'manager', 'requestor']).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, 'Send at least one field to change');

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
