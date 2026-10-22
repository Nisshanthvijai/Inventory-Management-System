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
4. Say where we are in the request path: guard → pipe → controller → service → Supabase → filter.
5. When a new Nest concept appears for the first time (module, provider, DI, guard, pipe, decorator, filter, Reflector), explain it with one small example before using it.
6. Do not build ahead. Do not refactor earlier steps unless I ask.
7. At the end of each endpoint: run the tests and give me the exact request to try in Postman or Swagger.

## Build order
0. Scaffold: project, tsconfig, `main.ts`, `setup.ts`, `app.module.ts`, `.env.local` via ConfigModule
1. `GET /api/health` (controller only; first module)
2. `SupabaseService` (provider, DI) and `POST /api/auth/login` (schema, service, ZodPipe, controller)
3. `AuthGuard`, `@Public()`, `@CurrentDb()` and `GET /api/users/me`
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
  domain/common/          api-error.ts, auth-user.ts      (no imports from other layers)
  application/<feature>/  *.service.ts, *.dto.ts (zod)    (business rules; master.resources.ts)
  application/auth/       auth-provider.ts                (AuthProvider = port: signIn(), verifyToken(); null on failure)
  application/common/     roles.ts, db-factory.ts         (DbFactory = port: anon(), forUser(token))
  infrastructure/supabase/ supabase.service.ts (implements DbFactory), supabase-auth.provider.ts
                          (implements AuthProvider), supabase.module.ts (@Global)
  presentation/<feature>/ *.controller.ts, *.module.ts    (HTTP only)
  presentation/common/    auth.guard.ts, authed-request.ts, public.decorator.ts, current.decorators.ts,
                          zod.pipe.ts, uuid.pipe.ts, all-exceptions.filter.ts, api-zod-body.ts
test/                     one vitest + supertest file per area, fake-db.ts
```
Dependency direction: presentation → application → domain; infrastructure → application (implements its ports) → domain. Never the reverse.
presentation never imports infrastructure: inject `DbFactory` / `AuthProvider`, not `SupabaseService`.
`SupabaseModule` binds `{ provide: DbFactory, useExisting: SupabaseService }` and `{ provide: AuthProvider, useClass: SupabaseAuthProvider }`.
Login and token checks go through `AuthProvider` (no Supabase API in `AuthService` or the guard). Queries and RPCs still use the `SupabaseClient` from `DbFactory.forUser`, so only auth is swappable, not the database.
`app.module.ts` is the composition root: the only file that imports every layer (it registers `SupabaseModule` once; it is `@Global`).
Tests override `SupabaseService`; `DbFactory` follows it because of `useExisting`.
`domain/` imports nothing from the other layers. One deliberate exception: `ApiError` extends Nest's `HttpException`, because the filter relies on it. `AuthedRequest` (HTTP + SupabaseClient) lives in presentation; `AuthUser` lives in domain.
New files go in the layer that matches the table above. `tsc` does not check `test/`, so run `npm test` after moving files.

## Rules of the project
- NEVER use the service_role key. Always forward the user's JWT (`SupabaseService.forUser`).
- Controllers do HTTP only (one or two lines per method). Business rules live in services.
- Services take `(db, ...)` and never build HTTP responses; they throw `ApiError`.
- Units: PR and stock use the stock unit; PO and GRN use the purchase unit. Stock units = purchase qty × `units_per_purchase`.
- Pack rounding: allowed PO qty = ceil(approved / units_per_purchase) when units_per_purchase > 1.
- Roles: admin, manager, requestor. Requestors never see prices (use `get_my_po_lines`).
- Views (`v_*`) are read-only. Statuses change automatically; never set them by hand.
- The database enforces the same rules again (RLS, triggers, RPCs `create_pr`, `create_po`, `create_grn`).

## Commands
`npm run start:dev` (http://localhost:3000/api, docs at /docs), `npm test`, `npx tsc --noEmit`, `npm run build`.

## Style
Terse, practical. Short explanations. Plain words.
