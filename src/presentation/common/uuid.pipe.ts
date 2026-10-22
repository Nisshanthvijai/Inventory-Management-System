import { z } from 'zod';
import { ZodPipe } from './zod.pipe';

/** For URL params like `:id`. Rejects anything that is not a UUID with a 400. */
export class UuidPipe extends ZodPipe<string> {
  constructor() {
    super(z.uuid('Must be a valid UUID'));
  }
}
