import type { ZodSchema } from 'zod';
import { z } from 'zod';

export class ValidationError extends Error {}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    throw new ValidationError(`Invalid request: ${detail}`);
  }
  return result.data;
}

// Money amounts are always server-derived for calculations; this bounds the
// member-entered request amounts (e.g. encashment) to sane values.
export const moneyAmountSchema = z.number().finite().positive().max(10_000_000);

export const codeQuantitySchema = z.number().int().min(1).max(100);
