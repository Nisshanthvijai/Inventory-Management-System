import { z } from 'zod';
import { UnexpectedError } from '../../application/common/errors';

/**
 * Checks what an RPC returned (the generated types say only `Json`) instead of casting it.
 * Use z.looseObject schemas, so extra fields the function returns are kept, not dropped.
 */
export function parseRpcResult<T>(schema: z.ZodType<T>, data: unknown, rpc: string): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new UnexpectedError(`${rpc} returned an unexpected result`);
  return result.data;
}
