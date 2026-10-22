/**
 * Compile-time check that two types are exactly the same. Each repository uses it to tie the
 * application's read model to the generated database row, so a schema change breaks the build:
 *
 *   assertExact<Exact<StockRow, Row<'v_stock'>>>();
 */
export type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function assertExact<T extends true>(): void {}
