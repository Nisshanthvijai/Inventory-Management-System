# IMS API: learning build (Nest.js)

I am learning Nest.js by rebuilding the IMS API one endpoint at a time. The goal is that I understand every file, not that it finishes fast.

Project: Inventory Management (ISMO Biophotonics): Item Master → PR → PO → GRN.
Stack: Nest.js, TypeScript, zod 4, @nestjs/swagger, vitest + supertest, Supabase project `abpfhvegpqouwqzksgxx` (Postgres + Auth + RLS + RPC).
Reference solution (answer key, read-only, do not copy-paste from it blindly): `../ims-nest`

## How to work with me (most important)
1. Build ONE endpoint (or one concept) per step. Never several at once.
2. Within a step, touch ONE layer at a time, in this order, and STOP after each layer:
   schema (zod) → service → pipe/guard/decorator if new → controller → module wiring → test → run it.
3. After each layer: show the code, then explain in 3 to 5 lines: what it is, why it exists, and which Nest concept it uses. Then ask "next?" and wait.
4. Say where we are in the request path: guard → pipe → controller → service → repository → Supabase → filter.
5. When a new Nest concept appears for the first time (module, provider, DI, guard, pipe, decorator, filter, Reflector), explain it with one small example before using it.
6. Do not build ahead. Do not refactor earlier steps unless I ask.
7. At the end of each endpoint: run the tests and give me the exact request to try in Postman or Swagger.

## Build order
0. Scaffold: project, tsconfig, `main.ts`, `setup.ts`, `app.module.ts`, `.env.local` via ConfigModule
1. `GET /api/health` (controller only; first module)
2. `SupabaseService` (provider, DI) and `POST /api/auth/login` (schema, service, ZodPipe, controller)
3. `AuthGuard`, `@Public()`, `@CurrentDb()` (now `@CurrentSession()`) and `GET /api/users/me`
4. `AllExceptionsFilter` and the `ApiError` type
5. `GET /api/stock`
6. PR: `POST /api/pr`, `GET /api/pr`, `GET /api/pr/:id` (UuidPipe)
7. `PATCH /api/pr-lines/:id` (manager decision rules)
8. PO: `POST /api/po` (pack-rounding rule), `GET /api/po`, `GET /api/po/:id`, `POST /api/po/:id/cancel`
9. `GET /api/po-lines/mine`, then GRN: `POST /api/grn`, `GET /api/grn`
10. Master data, users, stock patch
11. Swagger docs, then the e2e test suite

## Folder layout (clean architecture)
```
src/
  main.ts, setup.ts, app.module.ts, swagger.ts
  domain/common/          errors.ts, auth-user.ts, role.ts (Role), permissions.ts (PERMISSIONS, assertCan)
                          (no imports from other layers or frameworks)
  domain/<feature>/       *-rules.ts, *-status.ts   (pure business rules and status types)
  application/common/     session.ts (Session, SessionFactory ports), role-reader.ts (RoleReader port),
                          permission.service.ts, errors.ts (Unauthenticated, UnexpectedError)
  application/auth/       auth.service.ts, auth.dto.ts, auth-provider.ts (AuthProvider port)
  application/<feature>/  <feature>.service.ts   (use cases: permission → load → domain rules → save)
                          <feature>.repository.ts (repository port), <feature>.types.ts (read models),
                          <feature>.dto.ts (zod request schemas); master/master.resources.ts (key, label,
                          readPermission, schemas)
  infrastructure/supabase/ supabase.service.ts (builds clients), supabase-session.ts (SupabaseSession, dbOf),
                          supabase-auth.provider.ts, supabase-role.reader.ts, db.ts (Db, rpcArgs, untyped),
                          database.types.ts (generated), rpc-result.ts, supabase.module.ts (@Global)
  infrastructure/supabase/repositories/  supabase-<feature>.repository.ts, index.ts (bindings), exact.ts
  presentation/<feature>/ *.controller.ts, *.module.ts (HTTP only); master/master.routes.ts (URL paths)
  presentation/common/    auth.guard.ts, authed-request.ts, public.decorator.ts, current.decorators.ts,
                          zod.pipe.ts, uuid.pipe.ts, all-exceptions.filter.ts, api-zod-body.ts, api-error.ts,
                          common.module.ts (@Global: provides PermissionService)
test/                     one vitest + supertest file per area, unit tests for rules, fake-db.ts
docs/architecture-review.md   the review and the fix plan with its progress
```

### Dependency rule
presentation → application → domain; infrastructure → application (implements its ports) → domain. Never the reverse.
- `domain/` imports nothing from other layers or frameworks.
- `application/` imports domain, zod and Nest's `@Injectable` only. Never Supabase, never infrastructure.
- `presentation/` never imports infrastructure or Supabase.
- Supabase (`@supabase/supabase-js`, `Db`, `database.types.ts`) appears only in `infrastructure/`.
- `app.module.ts` is the composition root: it registers the `@Global` `SupabaseModule` (binds every port) and `CommonModule` once.

### Ports and how they are bound
`SupabaseModule` binds `SessionFactory → SupabaseSessionFactory`, `AuthProvider → SupabaseAuthProvider`, `RoleReader → SupabaseRoleReader`, and every repository port through `repositories/index.ts` (`REPOSITORIES`, `REPOSITORY_TOKENS`). To add a repository: port in `application/<feature>/`, implementation in `infrastructure/supabase/repositories/`, one line in `index.ts`.
Tests override `SupabaseService` with a fake; sessions, repositories and readers all use it underneath.

### Request path
guard (verifies the token through `AuthProvider`, sets `req.user` and `req.session = SessionFactory.forUser(token)`) → pipes (`ZodPipe`, `UuidPipe`) → controller (`@CurrentSession()`, `@CurrentUser()`, one line) → service → repository → Supabase → filter.
`Session` is opaque: services pass it to repositories and cannot see inside it. Only infrastructure calls `dbOf(session)`.

### Services and repositories
- Services take `(session, user, ...)`. They check permissions, call repositories, apply domain rules, and throw 404s for missing rows. They never build HTTP responses and never see table names, SQL error codes or the client.
- Repositories own the queries, table/view names, column lists, RPC calls, the mapping of DB error codes (`P0001`, `23505`, `42501`, ...) and trigger-message matches to app errors, and data-integrity checks on rows read from views.
- Repository methods are named for the use case (`loadOrderContext`, `cancelIfOpen`, `saveDecision`), not for tables.

### Errors
Domain rules, services and repositories throw app errors, never HTTP ones: `RuleViolation`, `NotAllowed`, `NotFound`, `Conflict` (domain/common/errors.ts), `Unauthenticated`, `UnexpectedError` (application/common/errors.ts). `AllExceptionsFilter` is the only place that maps an error kind to an HTTP status. `ApiError` (an `HttpException`) lives in presentation and is used only by `ZodPipe`.
Every 500 (an `UnexpectedError` or any unknown throw) is logged with its real message and sent as `"Something went wrong"`: database text never reaches the client. Put the database message in `UnexpectedError` anyway; it is what the log shows. Tests mute the console logger in `test/setup.ts`; to check the log, spy on `Logger.prototype.error`.

### Domain rules
A check that uses only plain values (status, quantities, units, roles) goes in `domain/<feature>/` as a pure function with a unit test in `test/`; a rule used by more than one feature goes in `domain/common/`.

### Types
- `database.types.ts` is generated from the Supabase schema; never edit it by hand, regenerate it after every migration. Repositories use `Db` (never the bare `SupabaseClient`).
- Read models (what services return) are declared in `application/<feature>/<feature>.types.ts`. Each repository ties them to the generated rows with `assertExact<Exact<ReadModel, Row<'...'>>>()`, so schema drift breaks the build.
- View columns are typed nullable: repositories check them before use. Status and role values read from the DB go through `isPoStatus` / `isPrLineStatus` / `isRole`.
- RPCs with optional args use `rpcArgs<'name'>({...})` (all optional args are `DEFAULT NULL`). RPC results (typed `Json`) go through `parseRpcResult(schema, data, 'rpc_name')` with a `z.looseObject` schema, never a cast.
- Only the master repository may use `untyped(db)` (it picks the table at runtime; table names are still typed).
- Keep select strings as one literal so the typed client can read them.

New files go in the layer that matches the layout above. `tsc` does not check `test/`, so run `npm test` after moving files.

## Rules of the project
- NEVER use the service_role key. Always forward the user's JWT (the guard opens a `Session` with it; `SupabaseService.forUser` underneath).
- Controllers do HTTP only (one or two lines per method). Business rules live in services and the domain.
- Units: PR and stock use the stock unit; PO and GRN use the purchase unit. Stock units = purchase qty × `units_per_purchase`.
- Pack rounding: allowed PO qty = ceil(approved / units_per_purchase) when units_per_purchase > 1.
- Roles: admin, manager, requestor. Requestors never see prices (use `get_my_po_lines`).
- Who may do what lives in one table, `domain/common/permissions.ts`. Services inject `PermissionService` and call `await this.permissions.require(session, user, '<action>')`; never compare role strings in a service. The role is read (through the `RoleReader` port) only when a check runs, so a request rejected by a pipe never touches the database. Role and status values are typed (`Role`, `PoStatus`, `PrLineStatus`) and match the DB CHECK constraints.
- Views (`v_*`) are read-only. Statuses change automatically; never set them by hand.
- The database enforces the same rules again (RLS, triggers, RPCs `create_pr`, `create_po`, `create_grn`).

## Commands
`npm run start:dev` (http://localhost:3000/api, docs at /docs), `npm test`, `npx tsc --noEmit`, `npm run build`.
