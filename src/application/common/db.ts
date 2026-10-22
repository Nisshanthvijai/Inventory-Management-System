import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

/** The database client a use case works with: typed by the generated schema, acting as one user. */
export type Db = SupabaseClient<Database>;

type Functions = Database['public']['Functions'];
type Args<Name extends keyof Functions> = Functions[Name]['Args'];

/**
 * RPC arguments where optional parameters may also be null. The generator types them as `?: T`,
 * but every optional parameter of our functions is `DEFAULT NULL`, so null is valid and means
 * the same as leaving it out.
 */
export type RpcArgs<Name extends keyof Functions> = {
  [K in keyof Args<Name>]: Args<Name>[K] | (undefined extends Args<Name>[K] ? null : never);
};

/** Passes RpcArgs to `db.rpc` (the one place that bridges the generator's stricter type). */
export function rpcArgs<Name extends keyof Functions>(args: RpcArgs<Name>): Args<Name> {
  return args as Args<Name>;
}

/** A client without schema types. Only for code that picks the table at runtime (MasterService). */
export type UntypedDb = SupabaseClient;

export function untyped(db: Db): UntypedDb {
  return db as unknown as UntypedDb;
}
