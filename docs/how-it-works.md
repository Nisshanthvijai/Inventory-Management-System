# How this codebase works, and why it looks this way

A guide for learning. It answers three questions:

1. How does a request flow through the code? (section 1)
2. How does the app start, and how does login work? (sections 2 and 3)
3. Why is this version better than the 6/10 version, and which principle drove each change? (section 4)

Sections 5 to 7 are the honest limits, some recipes, and a cheat sheet.

Links are relative to this file. Every code snippet is real, taken from the repo or from git history (`15da7c4` is the 6/10 version).

---

## 0. The big picture

The code is split into four layers. Code may only depend on layers **inside** it, never outside.

```
                 ┌──────────────────────────────────────────────┐
                 │ presentation/   HTTP only                    │
                 │ controllers, guard, pipes, filter, modules   │
                 └───────────────────────┬──────────────────────┘
                                         │ depends on
                 ┌───────────────────────▼──────────────────────┐
                 │ application/    the use cases                │
                 │ services, ports (abstract classes), DTOs,    │
                 │ read-model types                             │
                 └───────────────────────┬──────────────────────┘
                                         │ depends on
                 ┌───────────────────────▼──────────────────────┐
                 │ domain/         the business rules           │
                 │ pure functions, Role/Status types, AppError  │
                 │ imports NOTHING (no Nest, no Supabase)       │
                 └───────────────────────▲──────────────────────┘
                                         │ implements the ports of application/
                 ┌───────────────────────┴──────────────────────┐
                 │ infrastructure/   Supabase lives ONLY here   │
                 │ repositories, session, auth provider         │
                 └──────────────────────────────────────────────┘
```

**The dependency rule:** arrows point inward. `domain` knows nothing about anyone. `application` knows `domain`. `presentation` and `infrastructure` know `application` and `domain`, and never each other.

I checked this with a script that reads every `import` in `src/`: 99 files, 0 violations, 0 cycles.

### Words you need

| Word | Meaning here | Example |
|---|---|---|
| **Port** | An `abstract class` in `application/` that says *what* is needed, not *how* | [`PoRepository`](../src/application/po/po.repository.ts), [`AuthProvider`](../src/application/auth/auth-provider.ts) |
| **Adapter** | A class in `infrastructure/` that implements a port using Supabase | [`SupabasePoRepository`](../src/infrastructure/supabase/repositories/supabase-po.repository.ts) |
| **Binding** | The one line that says "when someone asks for the port, give them this adapter" | [`supabase.module.ts`](../src/infrastructure/supabase/supabase.module.ts) |
| **Session** | An opaque handle for "the database acting as this user". Services pass it along but cannot look inside | [`session.ts`](../src/application/common/session.ts) |
| **Repository** | An adapter that owns the queries for one feature | `supabase-*.repository.ts` |
| **Read model** | The type of data a use case returns | [`po.types.ts`](../src/application/po/po.types.ts) |
| **Domain rule** | A pure function on plain values: no database, no HTTP | [`po-line-rules.ts`](../src/domain/po/po-line-rules.ts) |
| **AppError** | A failure the app reports on purpose, with a `kind` but no HTTP status | [`errors.ts`](../src/domain/common/errors.ts) |

Why abstract classes and not interfaces? Nest's dependency injection needs a *value* at runtime to use as a token. An interface disappears when TypeScript compiles; an abstract class stays.

---

## 1. The code flow of one request

Example: `POST /api/po` (create a purchase order). It touches every part of the system. Login (section 3) is shorter, with one extra twist.

```
HTTP request
   │
   ▼
 AuthGuard ──────────► AuthProvider.verifyToken ──► Supabase Auth     "who are you?"
   │  sets req.user, req.session
   ▼
 ZodPipe ────────────► createPoSchema.safeParse                        "is the body shaped right?"
   │
   ▼
 PoController.create                                                   one line, HTTP only
   │
   ▼
 PoService.create                                                      the use case
   ├─► PermissionService.require ─► RoleReader ─► profile table        "may you do this?"
   ├─► PoRepository.loadOrderContext ─► 3 queries                      "load what I need"
   ├─► assertPoLineAllowed (domain)                                    "do the business rules allow it?"
   └─► PoRepository.create ─► rpc create_po                            "save"
   │
   ▼
 Response JSON         (or, on any error: AllExceptionsFilter ─► status + JSON)
```

The order is Nest's request lifecycle: **guard → pipe → controller**. A request with a bad token and a bad body gets the 401 first.

### Hop by hop

**1. The guard** ([`auth.guard.ts`](../src/presentation/common/auth.guard.ts))
Reads `Authorization: Bearer <token>`. Routes marked `@Public()` skip it. Otherwise:

```ts
const user = await this.auth.verifyToken(token);       // port: AuthProvider
if (!user) throw new UnauthorizedException('Invalid or expired token');
req.user = user;
req.session = this.sessions.forUser(token);            // port: SessionFactory
```

The guard does not know Supabase exists. It only talks to two ports. The `Session` it creates carries the *user's own token*, so every later query runs as that user and the database's Row Level Security (RLS) applies. The `service_role` key is never used.

**2. The pipe** ([`zod.pipe.ts`](../src/presentation/common/zod.pipe.ts))
Checks the body against the zod schema `createPoSchema`. Bad body: `400` with `details`, and nothing touches the database. Good body: the typed `CreatePoDto` goes on.

**3. The controller** ([`po.controller.ts`](../src/presentation/po/po.controller.ts))

```ts
create(@CurrentSession() session: Session, @CurrentUser() user: AuthUser,
       @Body(new ZodPipe(createPoSchema)) dto: CreatePoDto) {
  return this.po.create(session, user, dto);
}
```

One line. The controller's only job is HTTP: read the request, call the use case, return the result.

**4. The service** ([`po.service.ts`](../src/application/po/po.service.ts))
The use case in four steps: permission, load, rules, save.

```ts
await this.permissions.require(session, user, 'po.create');            // 1. permission
const order = await this.pos.loadOrderContext(session, ids);           // 2. load
for (const line of dto.lines) { ...; assertPoLineAllowed({...}); }     // 3. domain rules
return this.pos.create(session, dto);                                  // 4. save
```

The service never sees a table name, a SQL error code or the Supabase client.

**5. Permissions** ([`permissions.ts`](../src/domain/common/permissions.ts), [`permission.service.ts`](../src/application/common/permission.service.ts))
One table says who may do what (`'po.create': managers and admins`). `PermissionService` reads the caller's role through the `RoleReader` port, then calls `assertCan`. The role is read only when a check runs, so a request that a pipe rejected never touches the database.

**6. The domain rule** ([`po-line-rules.ts`](../src/domain/po/po-line-rules.ts))
For example the pack-rounding rule: `ceil(approved / units_per_purchase)`. It's a pure function: values in, error or nothing out. That's why it can be unit tested with no setup.

**7. The repository** ([`supabase-po.repository.ts`](../src/infrastructure/supabase/repositories/supabase-po.repository.ts))
This is the only place that knows `v_po_lines`, `.in('id', ...)`, `rpc('create_po')` and Postgres error codes. It unwraps the session with `dbOf(session)`, runs the query, and translates database failures into app errors:

```ts
if (error.code === '23505') throw new Conflict('This PR line is already on this PO');
if (error.code === '42501') throw new NotAllowed('You cannot create a PO');
throw new UnexpectedError(error.message);   // anything else
```

**8. The filter** ([`all-exceptions.filter.ts`](../src/presentation/common/all-exceptions.filter.ts))
Catches every error and is the **only** place that turns an error kind into an HTTP status.

| Thrown | Born in | HTTP |
|---|---|---|
| missing or bad token | guard | 401 |
| bad body | `ZodPipe` | 400 + `details` |
| `RuleViolation` | domain rule or repository | 400 |
| `Unauthenticated` | `AuthService` | 401 |
| `NotAllowed` | `assertCan` or repository | 403 |
| `NotFound` | service | 404 |
| `Conflict` | domain rule or repository | 409 |
| `UnexpectedError`, or any other crash | repository | 500, generic message, real cause logged |

### Who knows what

| | Knows HTTP? | Knows Supabase? | Knows business rules? |
|---|---|---|---|
| domain | no | no | **yes** |
| application (services) | no | no | calls them |
| infrastructure | no | **yes** | no |
| presentation | **yes** | no | no |

Each concern has exactly one home. That is the entire point.

---

## 2. How the app starts

Entry point: [`main.ts`](../src/main.ts).

```ts
const app = await NestFactory.create(AppModule);
setupApp(app);        // prefix, CORS, error filter
setupSwagger(app);    // /docs (real server only; tests skip it)
await app.listen(process.env.PORT ?? 3000);
```

### Step 1: Nest builds the module graph from `AppModule`

[`app.module.ts`](../src/app.module.ts) is the **composition root**: the one place where everything is wired together.

```ts
imports: [
  ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.local' }),  // reads .env.local
  SupabaseModule,   // @Global: binds every port to its Supabase adapter
  CommonModule,     // @Global: provides PermissionService
  HealthModule, AuthModule, StockModule, PrModule, PrLinesModule,
  PoModule, PoLinesModule, GrnModule, MasterModule, UsersModule,
]
```

### Step 2: Nest creates the objects (dependency injection)

Nest looks at each constructor, finds what it asks for, and builds it first. For the login path it resolves like this:

```
AuthController   needs  AuthService
AuthService      needs  AuthProvider            ← abstract class (port)
AuthProvider     is bound (SupabaseModule) to   SupabaseAuthProvider
SupabaseAuthProvider  needs  SupabaseService
SupabaseService  needs  ConfigService           ← getOrThrow('SUPABASE_URL' / 'SUPABASE_ANON_KEY')
```

Two things worth noticing:

- **Fail fast:** if `SUPABASE_URL` or `SUPABASE_ANON_KEY` is missing from `.env.local`, the app refuses to start rather than failing on the first request.
- **The binding:** this line in [`supabase.module.ts`](../src/infrastructure/supabase/supabase.module.ts) is the entire connection between the abstract port and the real thing:

  ```ts
  { provide: AuthProvider, useClass: SupabaseAuthProvider }
  ```

  The same module binds `SessionFactory`, `RoleReader` and the eight repository ports.

### Step 3: the guard is registered for the whole app

[`auth.module.ts`](../src/presentation/auth/auth.module.ts) registers `{ provide: APP_GUARD, useClass: AuthGuard }`. That makes it a *global* guard: every route needs a valid token unless it is marked `@Public()`. Secure by default: a new endpoint is protected unless someone opts it out.

### Step 4: `setupApp` ([`setup.ts`](../src/setup.ts))

- `setGlobalPrefix('api')`: every route starts with `/api`.
- CORS allows only the origins listed in `CORS_ORIGINS`.
- `useGlobalFilters(new AllExceptionsFilter())`: all errors go through the one filter.

Then the server listens. `GET /api/health` is the simplest check that it is up.

---

## 3. The login flow

`POST /api/auth/login` with `{ "email": "...", "password": "..." }`.

```
Client
  │  POST /api/auth/login {email, password}
  ▼
AuthGuard ........ route is @Public() → lets it through (no token needed)
  ▼
ZodPipe(loginSchema) ... email valid? password not empty?   ──no──► 400 + details
  ▼
AuthController.login(dto)  ... one line
  ▼
AuthService.login(dto)                                   application/auth/auth.service.ts
  │   result = await provider.signIn(email, password)    ← talks to the PORT
  ▼
SupabaseAuthProvider.signIn                              infrastructure/supabase/
  │   supabase.anon().auth.signInWithPassword(...)       ← the ONLY Supabase call
  ▼
Supabase Auth
  │
  ├── wrong credentials / no session ──► provider returns null
  │        AuthService throws Unauthenticated('Invalid email or password')
  │        AllExceptionsFilter ──► 401
  │
  └── ok ──► provider returns { access_token, refresh_token, expires_in, user }
           AuthService returns it ──► 200 JSON
```

### The code, piece by piece

**The schema and DTO** ([`auth.dto.ts`](../src/application/auth/auth.dto.ts)):

```ts
export const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
export type LoginDto = z.infer<typeof loginSchema>;
```

One source of truth. The schema validates at runtime, and `LoginDto` is derived from it, so the type and the check can never disagree.

**The controller** ([`auth.controller.ts`](../src/presentation/auth/auth.controller.ts)): `@Public()` opens the route, `@HttpCode(200)` makes it return 200 instead of POST's default 201, and `ZodPipe` validates before the method runs.

**The service** ([`auth.service.ts`](../src/application/auth/auth.service.ts)):

```ts
async login(dto: LoginDto) {
  const result = await this.provider.signIn(dto.email, dto.password);
  if (!result) throw new Unauthenticated('Invalid email or password');
  return result;
}
```

It does not know the answer came from Supabase. It only knows the `AuthProvider` contract: *"email and password in; tokens out, or `null` if the credentials are wrong."*

**The adapter** ([`supabase-auth.provider.ts`](../src/infrastructure/supabase/supabase-auth.provider.ts)): builds an *anonymous* Supabase client (anon key, no user yet), calls `signInWithPassword`, and maps the answer to the port's `SignInResult` shape.

### What the client gets

| Case | Response |
|---|---|
| good credentials | `200 { access_token, refresh_token, expires_in, user: { id, email } }` |
| bad email format, empty password | `400 { message: 'Validation failed', details: [...] }` |
| wrong password | `401 { message: 'Invalid email or password' }` |
| crash inside Supabase client | `500 { message: 'Something went wrong' }`, real cause in the server log |

The error body always has the same shape: `{ statusCode, error, message, details? }`.

### What happens next with the token

The client sends the `access_token` as `Authorization: Bearer ...` on every later request. Back in section 1, the guard calls `AuthProvider.verifyToken(token)` (a `getUser` call to Supabase Auth), gets the user, and creates a `Session` with that token. That is what makes RLS work: the database sees *the user*, not a super-account.

### A known soft spot

If Supabase is unreachable, `signIn` and `verifyToken` return `null`, which looks like "bad credentials" (a 401), not "service down" (a 503). The port promises `null` only for invalid credentials, so the adapter breaks its own contract in that case. This is the review's step 5. You chose to leave it as it is.

---

## 4. Why the code changed (6/10 to 8/10)

### The five SOLID principles in one line each, with where they live now

| | Principle | In this codebase |
|---|---|---|
| **S** | A class has one reason to change | A service decides *what* happens; a repository knows *how* the data is stored; a controller only does HTTP |
| **O** | Add behaviour by adding code, not editing old code | New permission = one row in `PERMISSIONS`. New master table = one config entry. New role = one value in `ROLES` |
| **L** | A substitute must keep the promises of what it replaces | Any `AuthProvider` must return `null` for bad credentials, and nothing else |
| **I** | Depend on small, specific contracts | A service gets an opaque `Session`, not the whole database client. Each feature has its own small repository port |
| **D** | High-level code depends on abstractions, not details | Services depend on `PoRepository` (abstract), never on Supabase. The binding is in one module |

Beyond SOLID, two more ideas were used: the **dependency rule** (arrows point inward) and **make mistakes fail at compile time** (generated DB types, `assertExact`).

---

### Change 1: errors no longer speak HTTP

**Before.** The innermost layer extended a web-framework class and chose status codes:

```ts
// domain/common/api-error.ts (old): ApiError extends HttpException
throw new ApiError(404, 'PO not found');     // inside a service and domain rules
```

**Problem.** The business rules knew about HTTP. You could not reuse a rule from a script, a queue worker, or a gRPC service without dragging Nest along.

**Now.** Domain and services throw `NotFound`, `Conflict`, `NotAllowed`, `RuleViolation`. They carry a *kind*, not a number. [`AllExceptionsFilter`](../src/presentation/common/all-exceptions.filter.ts) is the only place that maps kind to status. `ApiError` moved to presentation and only `ZodPipe` uses it.

**Principle.** Dependency rule + **D**: inner layers must not know about outer ones. Also **O**: a new error kind means one new entry in the map.

---

### Change 2: roles and statuses became types, and permissions became one table

**Before.**

```ts
// application/common/roles.ts (old)
export async function requireManager(db: SupabaseClient, user: AuthUser, action: string) {
  const { data, error } = await db.from('profile').select('role').eq('id', user.id).maybeSingle();
  if (error) throw new ApiError(500, error.message);
  assertManagerOrAdmin(data?.role, action);
}
```

and about 26 bare strings like `'manager'`, `'open'` and `'accepted'` scattered through the code.

**Problem.** A typo such as `'manger'` compiled fine. "Who can do what" was spread over several files. And `requireManager` was a concrete function that queried the database itself, so you could not swap or test it.

**Now.**
- `Role`, `PoStatus` and `PrLineStatus` are types that match the database CHECK constraints. Values read from the DB go through guards like `isRole`.
- [`permissions.ts`](../src/domain/common/permissions.ts) is one table: action to allowed roles to denial message. A service says `permissions.require(session, user, 'po.create')`; it never compares role strings.

**Principle.** **O** (adding a role or action edits one table, not many `if`s) and make mistakes fail at compile time.

---

### Change 3: role lookup behind a port (`RoleReader` + `PermissionService`)

**Before.** The function above reached the database directly.

**Now.** `PermissionService` asks the `RoleReader` *port*; `SupabaseRoleReader` implements it.

**A design decision worth remembering.** The first idea was "the guard reads the role on every request". It broke about 20 tests whose point was that a request rejected by a pipe never touches the database. You chose "port, only when needed": the role is read only when a permission check actually runs.

**Principle.** **D** (the check depends on an abstraction) and **S** (reading roles and judging roles are separate jobs).

---

### Change 4: generated database types

**Before.** Query results were `any`, so services cast them: `as unknown as SomeType`.

**Problem.** If someone renamed a column, nothing complained until a user hit the bug.

**Now.** [`database.types.ts`](../src/infrastructure/supabase/database.types.ts) is generated from the real schema; the client is `SupabaseClient<Database>`. Read models are tied to the generated rows with a compile-time check:

```ts
assertExact<Exact<PoSummary, Row<'v_purchase_order'>>>();
```

If the schema drifts from what the app expects, **the build fails**. View columns are typed as nullable, so repositories check them explicitly instead of trusting them. RPC results go through `parseRpcResult` with a zod schema, never a cast.

**Principle.** Make mistakes fail at compile time. It also supports **L**: what the app promises matches what the database gives.

---

### Change 5: the `Session` port instead of passing the database client around

**Before.** Every controller and service took a `SupabaseClient`:

```ts
async list(db: SupabaseClient, user: AuthUser) { ... }
```

**Problem.** `SupabaseClient` was imported in 10 application files, 8 controllers and the request type (20 files in all). A "port" existed (`DbFactory`) but it returned the vendor type, so it hid nothing. A service could do anything with the client: any table, any RPC.

**Now.** Services receive an opaque `Session`:

```ts
export abstract class Session { protected readonly kind = 'session' as const; }
```

It has no usable members, so a service can only pass it on. [`SupabaseSession`](../src/infrastructure/supabase/supabase-session.ts) wraps the real client, and only repositories call `dbOf(session)` to unwrap it. Supabase is now imported *only* in `infrastructure/`.

**Principle.** **I** (a service gets a handle that exposes nothing it should not use) and **D** (nothing above infrastructure depends on the vendor).

---

### Change 6: one repository per feature

This is the biggest change. In the 6/10 version, `PoService.create` did **six jobs**: check permission, run three queries, build a lookup map, apply business rules, call the RPC, and translate Postgres error codes into HTTP errors. 73 lines in one method. Compare:

```ts
// BEFORE (old PoService.create, shortened)
const { data: prLines, error: prError } = await db.from('pr_line').select(...).in('id', ids);
if (prError) throw new ApiError(500, prError.message);
const { data: variants, ... } = await db.from('v_variants')...
const { data: ordered, ... } = await db.from('v_po_lines')...
const orderedStock = new Map<string, number>(); for (const o of ordered ?? []) { ... }
for (const line of dto.lines) { ...assertPoLineAllowed(...) }
const { data, error } = await db.rpc('create_po', {...});
if (error) { if (error.code === 'P0001' && error.message.includes('Vendor not found')) { ... } ... }

// AFTER (PoService.create)
await this.permissions.require(session, user, 'po.create');
const order = await this.pos.loadOrderContext(session, ids);
for (const line of dto.lines) { ...assertPoLineAllowed(...) }
return this.pos.create(session, dto);
```

**Problem.** Changing a column name, a query or an error code meant editing the business logic. Testing the logic meant mocking Supabase query chains.

**Now.** The service has one job (orchestrate). [`PoRepository`](../src/application/po/po.repository.ts) is a port named for *use cases* (`loadOrderContext`, `cancelIfOpen`, `saveDecision`), not for tables. [`SupabasePoRepository`](../src/infrastructure/supabase/repositories/supabase-po.repository.ts) owns the queries, the table and view names, the column lists, the RPCs, and the translation of database error codes into app errors. It also checks view rows before use.

**Principle.** **S** (query details and business flow change for different reasons, so they live in different classes), **D** (the service depends on the port), **I** (each feature has a small port).

Related: matching the text of database messages (`message.includes('goods received')`) used to sit in services. It now lives only in repositories, so a database wording change touches infrastructure only.

---

### Change 7: `MasterResource` split by layer

**Before.** One config object per master table mixed four things: the URL path, the table and columns, the zod schemas, and who may read it.

**Problem.** Four reasons to change in one place.

**Now.** Application keeps the label, the schemas and the read permission ([`master.resources.ts`](../src/application/master/master.resources.ts)). Presentation owns URL paths ([`master.routes.ts`](../src/presentation/master/master.routes.ts)). Infrastructure owns tables and columns (`MASTER_TABLES`). A compile-time `Record<MasterKey, ...>` in each place means a missing entry fails the build.

**Principle.** **S** and **I**. It stays **O**-friendly: a new master table is still just a few entries.

---

### Change 8: hide database text on 500s

**Before.** 30 places did `throw new ApiError(500, error.message)`, sending raw Postgres text to the client (table names, constraint names, internal wording).

**Now.** Every 500 returns `"Something went wrong"`; the real message goes to the server log.

**Principle.** Fail safely: don't leak internals. This is security rather than SOLID. It changed behaviour on purpose, and you agreed to it.

### Change 9: CORS from configuration

**Before.** `app.enableCors()` allowed every website to call the API from a browser.

**Now.** Only origins listed in `CORS_ORIGINS` are allowed. Unset means none. Postman and the Swagger page are unaffected.

**Principle.** Least privilege.

---

### What we chose **not** to do

- **503 on a network failure.** A network failure still looks like a bad login (a 401). You decided to leave it.
- **Database error codes in triggers.** Matching message text is now isolated in four places in infrastructure, but the clean fix needs database migrations. Left for later.
- **`@Injectable()` in application services.** Technically a framework import in an inner layer, but it's the accepted trade-off in Nest, and the alternative adds a lot of ceremony.

### Scores

| Area | 6/10 version | Now |
|---|---|---|
| Clean Architecture | 6 | 8.5 |
| S | 7 | 8.5 |
| O | 7 | 8 |
| L | 6 | 7 |
| I | 6 | 8 |
| D | 5 | 8.5 |
| **Overall** | **6** | **8** |

The biggest jump is **D** (5 to 8.5): nothing above infrastructure depends on Supabase any more.

---

## 5. What this codebase is, and is not

It is a **well-structured** codebase using the same patterns that real production systems use: layers, ports and adapters, domain errors, typed boundaries. That structure is what makes a system easy to change as it grows.

It is not yet something I would call production-proven. An honest list, also in [`architecture-review.md`](architecture-review.md) as N1 to N11:

- **Tests do not use the ports.** 16 test files drive the whole app through a fake Supabase client. Nothing tests a service against an in-memory repository, so the ports give no testing benefit yet.
- **Thin domain.** Rules are functions on plain values; there are no `PurchaseOrder` or `Grn` entities.
- **Some database text still reaches clients on 4xx errors** (trigger messages are intended; constraint names are not).
- **Operations:** no login rate limiting, no request id in logs, and a Supabase auth call plus a fresh client on every request. "Scalable" here means *easy to change*, not *tuned for load*.

---

## 6. Recipes

### Add a new endpoint, e.g. `GET /api/widgets`

1. **domain**: add any pure rule (`domain/widget/widget-rules.ts`) and a permission row in `PERMISSIONS` if needed.
2. **application**: `widget.types.ts` (read model), `widget.repository.ts` (abstract port), `widget.dto.ts` (zod), `widget.service.ts` (permission, load, rules, save).
3. **infrastructure**: `supabase-widget.repository.ts` implementing the port, with `assertExact` on its read model; one line in [`repositories/index.ts`](../src/infrastructure/supabase/repositories/index.ts).
4. **presentation**: `widget.controller.ts` (one line per method) and `widget.module.ts`; add the module to `AppModule`.
5. Tests, then `npx tsc --noEmit` and `npm test`.

### Add a new role or permission

Add the value to `ROLES` ([`role.ts`](../src/domain/common/role.ts)) and/or a row to `PERMISSIONS`. No service changes.

### Swap the database

Write new adapters for `SessionFactory`, `AuthProvider`, `RoleReader` and each repository port, then change the bindings in one module. `domain`, `application` and `presentation` are untouched. One honest caveat: read models are tied to the current Supabase row shapes by `assertExact`, so a new database must either produce the same shapes or those read models change.

### A rule changes (e.g. a different pack-rounding formula)

Edit the domain function and its unit test. Nothing else moves.

---

## 7. Cheat sheet: where do I look?

| I want to... | Go to |
|---|---|
| see which routes exist | [`presentation/*/*.controller.ts`](../src/presentation), or `/docs` when the server runs |
| see who may do what | [`domain/common/permissions.ts`](../src/domain/common/permissions.ts) |
| see a business rule | `domain/<feature>/*-rules.ts` |
| see a use case | `application/<feature>/<feature>.service.ts` |
| see a SQL query or RPC call | `infrastructure/supabase/repositories/` |
| see how an error becomes a status code | [`all-exceptions.filter.ts`](../src/presentation/common/all-exceptions.filter.ts) |
| see what is bound to what | [`supabase.module.ts`](../src/infrastructure/supabase/supabase.module.ts) and [`repositories/index.ts`](../src/infrastructure/supabase/repositories/index.ts) |
| see the rules of the project | [`CLAUDE.md`](../CLAUDE.md) |
| see the review and its findings | [`architecture-review.md`](architecture-review.md) |

Commands: `npm run start:dev`, `npm test`, `npx tsc --noEmit`, `npm run build`.
