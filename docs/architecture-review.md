# Architecture review: Clean Architecture and SOLID

Review date: 2026-10-22. Scope: every file in `src/`, with import directions checked by grep.

## Scores at review time

| Area | Score |
|---|---|
| Clean Architecture (layers and boundaries) | 6/10 |
| S: Single Responsibility | 7/10 |
| O: Open/Closed | 7/10 |
| L: Liskov Substitution | 6/10 |
| I: Interface Segregation | 6/10 |
| D: Dependency Inversion | 5/10 |
| **Overall** | **6/10** |

## Strengths

- Import direction is correct everywhere: no layer imports a layer further out.
- Controllers are one line per handler; guard, pipes, filter and param decorators each do one job.
- `AppModule` is the composition root; `SupabaseModule` (`@Global`) binds the ports.
- `AuthProvider` is a real port: `AuthService` and the guard do not see Supabase.
- Domain rules are pure functions with unit tests.
- Master data is open for extension: a new table is a config entry.
- 388 tests, plus a Postman collection run against the real database.

## Findings

### Clean Architecture

| ID | Finding | Severity |
|---|---|---|
| C1 | `SupabaseClient` is used in 10 application files, 8 controllers and `AuthedRequest`. `DbFactory` returns the vendor type, so it is not a real port. | High |
| C2 | The domain speaks HTTP: `ApiError extends HttpException`, and domain rules throw 400/403/409. | High |
| C3 | Persistence lives in services: table and view names, column lists, `rpc()`, Postgres error codes. | High |
| C4 | Status codes depend on database message text (`message.includes('goods received')` and 3 others). | Medium |
| C5 | `MasterResource` mixes URL path, table/columns, zod schemas and read role in one object. | Medium |
| C6 | Thin domain: no entities; roles and statuses are bare strings (26 literals). | Medium |
| C7 | No generated DB types: rows are `any`, services return casts (`as unknown as ...`). | Medium |
| C8 | `@Injectable()` in the application layer. Accepted trade-off in Nest. | Low |

### SOLID

- **S:** `PoService.create` has six jobs; `MasterResource` has four reasons to change; error translation is in every use case.
- **O:** adding a role or status means editing string comparisons in several files; DB-error `if` chains grow per trigger.
- **L:** `AuthProvider.verifyToken` promises `null` for an invalid token, but the Supabase implementation also returns `null` on a network failure, so an outage looks like a bad login (seen as a 401 in Postman).
- **I:** services receive the whole `SupabaseClient`; `MasterResource` is a fat config; `AuthedRequest.token` is never read.
- **D:** all services depend on the concrete `SupabaseClient`; `requireAdmin` / `requireManager` are concrete functions that query the database.

### Smaller issues

- 31 `ApiError(500, error.message)` calls send raw Postgres text to clients.
- `users.me` turns a database error into a 403.
- The role is fetched from `profile` again on every role check.
- Authorization is spread over the guard, the services and RLS.
- `enableCors()` allows every origin.

## Fix plan

### Phase 1: clean up the domain layer (no behaviour change)

- [x] 1. Domain errors (`RuleViolation`, `NotAllowed`, `NotFound`, `Conflict`) instead of `ApiError`; the filter maps them to HTTP; `ApiError` moves to presentation. (C2)
- [x] 2. `Role`, `PoStatus`, `PrLineStatus` types matching the database CHECK constraints. (C6, O)
- [x] 3. One permission table (`domain/common/permissions.ts`) with `assertCan(role, action)`; messages stay word for word. (O, authorization spread)

### Phase 2: auth and roles

- [x] 4. Role checks go through a `RoleReader` port and an injected `PermissionService`; `roles.ts` goes away. *Changed from "the guard reads the role on every request": that added a query to every request (also ones a pipe rejects) and broke ~20 tested "no database call before validation" properties. The role is still read at most once per request, only when a check runs.* (D)
- [ ] 5. `AuthProvider`: a network failure throws 503 instead of returning `null`. (L) *Declined on 2026-10-22; kept here for the record.*
- [x] 6. `users.me`: a database error returns 500, not 403.

### Phase 3: types between layers

- [x] 7. Generated Supabase types; `SupabaseClient<Database>` everywhere. (C7)
- [x] 8. Response types per feature; remove the casts. (C7)

### Phase 4: repositories (large; changes the "services take `(db, ...)`" rule)

- [x] 9. An opaque `Session` port instead of `SupabaseClient`; `@CurrentSession()`; no Supabase in presentation. (C1)
- [x] 10. One repository port per feature, implemented in `infrastructure/supabase/repositories/`; queries and DB-error translation move there. (C3, S, I, D)
- [x] 11. Message matching moves into the repositories. (C4) *Done: the four matches now live only in infrastructure. Not done: triggers raising their own SQLSTATE codes (needs DB migrations; a separate decision).*
- [x] 12. Split `MasterResource` into presentation routes, domain policy and infrastructure table mapping. (C5, I)
- [x] 13. Update CLAUDE.md for sessions and repositories.

### Phase 5: smaller fixes

- [x] 14. `InfrastructureError`: log the real message, return a generic one. *Behaviour change.* *Done without a new class: `UnexpectedError` is already the "infrastructure failed" error, so `AllExceptionsFilter` logs it and sends "Something went wrong", like any unknown throw.*
- [x] 15. CORS origins from env. *Behaviour change.* *`CORS_ORIGINS` (comma-separated); unset means no cross-origin browser calls.*
- [x] 16. C8: leave it (accepted trade-off).

### Expected scores

| After phase | Overall |
|---|---|
| 1 | ~6.5 |
| 2 | ~7 |
| 3 | ~7 |
| 4 | ~8.5 |
| 5 | ~8.5 to 9 |

## Progress log

- 2026-10-22: review written; phases 1 to 3 started on branch `arch-phase-1-3`.
- 2026-10-22: phases 1 to 3 done on `arch-phase-1-3` (steps 1, 2, 3, 4, 6, 7, 8; step 5 declined). 445 tests pass; live server checked without login. Merged after a Postman run with a login.
- 2026-10-22: phase 4 done on `arch-phase-4` (steps 9 to 13). Supabase now appears only in infrastructure; 445 tests pass. Not merged; Postman run with a login still to do.
- 2026-10-22: phase 5 done on `arch-phase-5` (branched from `arch-phase-4`; steps 14, 15, 16). 500s send "Something went wrong" and log the real cause; CORS allows only `CORS_ORIGINS`. 449 tests pass; built server checked with and without `CORS_ORIGINS`.
- 2026-10-22: Postman run with a login passed on `arch-phase-5` (covers phases 4 and 5). Merged into `main` and pushed.
