import { ApiBody } from '@nestjs/swagger';
import { z } from 'zod';

/** Swagger can't read zod schemas, so turn one into an OpenAPI 3.0 body schema. */
export function ApiZodBody(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' });
  return ApiBody({ schema: stripPatterns(json) as object });
}

// zod adds long regex patterns next to `format` (uuid, date); `format` alone reads better in the docs.
function stripPatterns(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripPatterns);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'pattern' && 'format' in node) continue;
      out[key] = stripPatterns(value);
    }
    return out;
  }
  return node;
}
