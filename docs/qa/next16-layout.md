# QA Investigation Report: Next.js 16 Prerendering & Unstable Value (`Date.now()`) at `AccountantAppLayout`

**Author:** Lane A (Next.js 16 Layout Inspector)  
**Date:** October 28, 2026  
**Audited Target:** `src/app/(app)/app/layout.tsx` (`AccountantAppLayout`) and its dependency graph  
**Framework Environment:** Next.js `16.4.3`, React `19.3.0`, `@supabase/ssr` `0.12.7`, `@supabase/supabase-js` `2.118.0`  
**Configuration:** `cacheComponents: true`, `partialPrefetching: true` (in `next.config.ts`)  
**Scope:** Root cause analysis, exact call-site identification, execution call stack trace, and staged rendering mechanics for Next.js 16 prerendering error:  
`"Next.js encountered the unstable value Date.now() while prerendering, at AccountantAppLayout"`

---

## 1. Executive Summary & Core Findings

This investigation isolates the exact mechanism causing Next.js 16 to raise an unstable value warning/error for `Date.now()` attributed to `AccountantAppLayout` during prerendering and partial prefetching.

### 1.1 Quick Reference Matrix

| Investigation Area | Finding / Specification |
|:---|:---|
| **Primary Unstable Call** | `Date.now()` evaluated during JWT session expiry check |
| **Exact Call Site (Source)** | `node_modules/@supabase/auth-js/src/GoTrueClient.ts`, line **3067** |
| **Exact Call Site (Dist CJS)** | `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`, line **2541** |
| **Exact Call Site (Dist ESM)** | `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js`, line **2538** |
| **Secondary Call Site** | `node_modules/@supabase/auth-js/src/GoTrueClient.ts`, line **3102** (`stored.expires_at * 1000 > Date.now()`) |
| **Helper Call Sites** | `node_modules/@supabase/auth-js/src/lib/helpers.ts`, line **13** (`expiresAt`) and line **538** (`validateExp`) |
| **Next.js Patch Point** | `node_modules/next/dist/server/node-environment-extensions/date.js`, line **18** |
| **Next.js Interception Hook** | `node_modules/next/dist/server/node-environment-extensions/io-utils.js`, line **18** (`io()`) |
| **Root Architectural Trigger** | Next.js 16 Staged Rendering with `partialPrefetching: true` enforces `SyncIOMode.AllowedInDynamic` (Mode 3). Synchronous IO (`Date.now()`, `Math.random()`) is forbidden in all stages prior to `RenderStage.Dynamic` (Stage 30). |
| **Why `cookies()` Does Not Prevent This** | In Next.js 16, `cookies()` maps to `sessionData`, resolving in `RenderStage.ShellRuntime` (Stage 20). `ShellRuntime` is still a prefetchable prerender stage where synchronous IO remains forbidden. Only `await connection()` transitions execution to `RenderStage.Dynamic` (Stage 30). |
| **Owner Stack Attribution** | Next.js uses React's Component Owner Stack (`applyOwnerStack`). `AccountantAppLayout` is the actively rendering Server Component that invoked `requireFirmRole()`, causing the error to be reported at `AccountantAppLayout`. |

---

## 2. Root Cause & Exact Call Site Analysis

### 2.1 The Evaluation of `Date.now()` in `@supabase/auth-js`

When `AccountantAppLayout` resolves the user's firm role via `requireFirmRole('staff')`, the call stack descends into `@supabase/ssr` and its underlying `@supabase/auth-js` client (`GoTrueClient`).

In `GoTrueClient.__loadSession()`, the client reads the session cookie from the cookie store via `@supabase/ssr`'s storage adapter (`getItemAsync(this.storage, this.storageKey)`). When an active session is found, `GoTrueClient` determines whether the JWT token has expired or is about to expire before dispatching the user profile request:

#### Primary Source: `node_modules/@supabase/auth-js/src/GoTrueClient.ts:3061-3069`
```typescript
// A session is considered expired before the access token _actually_
// expires. When the autoRefreshToken option is off (or when the tab is
// in the background), very eager users of getSession() -- like
// realtime-js -- might send a valid JWT which will expire by the time it
// reaches the server.
const hasExpired = currentSession.expires_at
  ? currentSession.expires_at * 1000 - Date.now() < EXPIRY_MARGIN_MS
  : false
```
* **Line 3067**: The expression `currentSession.expires_at * 1000 - Date.now() < EXPIRY_MARGIN_MS` directly evaluates `Date.now()`.
* At this moment, JavaScript execution enters the global `Date.now()` function.

#### Distributed Output Lines
In the compiled packages distributed under `node_modules/@supabase/auth-js`:
- **CommonJS (`dist/main/GoTrueClient.js`)**:
  ```javascript
  2540: const hasExpired = currentSession.expires_at
  2541:     ? currentSession.expires_at * 1000 - Date.now() < constants_1.EXPIRY_MARGIN_MS
  2542:     : false;
  ```
- **ESM (`dist/module/GoTrueClient.js`)**:
  ```javascript
  2537: const hasExpired = currentSession.expires_at
  2538:     ? currentSession.expires_at * 1000 - Date.now() < EXPIRY_MARGIN_MS
  2539:     : false;
  ```

#### Secondary Call Site: `GoTrueClient.ts:3097-3104`
If a token refresh fails, `GoTrueClient` checks storage again:
```typescript
3097: const stored = (await getItemAsync(this.storage, this.storageKey)) as Session | null
3098: if (
3099:   stored &&
3100:   this._isValidSession(stored) &&
3101:   stored.expires_at &&
3102:   stored.expires_at * 1000 > Date.now()
3103: ) {
```
* **Line 3102** (`dist/main/GoTrueClient.js:2567`, `dist/module/GoTrueClient.js:2564`) evaluates `Date.now()` as a fallback validation.

#### Helper Utilities in `@supabase/auth-js/src/lib/helpers.ts`
Two auxiliary functions also evaluate `Date.now()`:
1. `expiresAt(expiresIn: number)` (`src/lib/helpers.ts:12-15`, `dist/main/lib/helpers.js:32-35`):
   ```typescript
   export function expiresAt(expiresIn: number) {
     const timeNow = Math.round(Date.now() / 1000)
     return timeNow + expiresIn
   }
   ```
2. `validateExp(exp: number)` (`src/lib/helpers.ts:534-542`, `dist/main/lib/helpers.js:456-464`):
   ```typescript
   export function validateExp(exp: number) {
     if (!exp) {
       throw new Error('Missing exp claim')
     }
     const timeNow = Math.floor(Date.now() / 1000)
     if (exp <= timeNow) {
       throw new Error('JWT has expired')
     }
   }
   ```

---

### 2.2 Next.js 16 Global Monkey-Patching of `Date`

Next.js 16 installs global environment extensions when `cacheComponents` is enabled. In `node_modules/next/dist/server/node-environment-extensions/date.js`:

```javascript
16: function createNow(originalNow) {
17:     return ({
18:         now: function now() {
19:             (0, _ioutils.io)('`Date.now()`', 'time');
20:             return originalNow();
21:         }
22:     })['now'.slice()].bind(null);
23: }
24: function createDate(originalConstructor) {
25:     const properties = Object.getOwnPropertyDescriptors(originalConstructor);
26:     properties.now.value = createNow(originalConstructor.now);
...
47:     Date = createDate(Date);
```

When `Date.now()` is called by `GoTrueClient`:
1. Next.js's wrapper intercepts the call.
2. It invokes `(0, _ioutils.io)('`Date.now()`', 'time')`.
3. `io()` inspects the current React/Next asynchronous storage context (`workUnitStore` and `workStore`).

---

## 3. Complete Execution Call Stack Trace

The call sequence begins in `AccountantAppLayout` and descends through the authentication layers into `@supabase/auth-js` before being intercepted by Next.js:

```
AccountantAppLayout (src/app/(app)/app/layout.tsx:19)
 └─ requireFirmRole('staff') (src/lib/auth/roles.ts:26)
     └─ requireUser() (src/lib/auth/require-user.ts:15)
         └─ getSessionContext() (src/lib/auth/session.ts:61-66)
             ├─ [Step 1] createServerClient() (src/lib/supabase/server.ts:13-15)
             │   ├─ await cookies() (next/headers) -> resolves in ShellRuntime
             │   └─ createSupabaseServerClient() (@supabase/ssr/src/createServerClient.ts:155)
             │       └─ createClient() (@supabase/supabase-js) -> instantiates GoTrueClient
             └─ [Step 2] supabase.auth.getUser() (node_modules/@supabase/auth-js/src/GoTrueClient.ts:3223)
                 └─ GoTrueClient._getUser() (GoTrueClient.ts:3237)
                     └─ GoTrueClient._useSession() (GoTrueClient.ts:3257)
                         └─ GoTrueClient.__loadSession() (GoTrueClient.ts:3001)
                             ├─ getItemAsync(this.storage, this.storageKey) (GoTrueClient.ts:3044)
                             │   └─ reads cookies via @supabase/ssr cookies adapter (cookies.ts:455)
                             │       └─ returns existing session JWT with `expires_at`
                             └─ [UNSTABLE CALL] evaluates session expiration (GoTrueClient.ts:3067)
                                 └─ Date.now()
                                     └─ Next.js Date.now wrapper (node-environment-extensions/date.js:18)
                                         └─ io('`Date.now()`', 'time') (io-utils.js:18)
                                             └─ createSyncIORuntimeError() (sync-io-messages.js:51)
                                                 └─ applyOwnerStack() -> attaches `AccountantAppLayout`
```

### Detailed Frame Breakdown Table

| Frame # | Function | File | Line # | Operation / Purpose |
|:---:|:---|:---|:---:|:---|
| **1** | `AccountantAppLayout` | `src/app/(app)/app/layout.tsx` | 19 | Server Component layout renders; invokes `await requireFirmRole('staff')`. |
| **2** | `requireFirmRole` | `src/lib/auth/roles.ts` | 26 | Verifies role hierarchy; invokes `await requireUser()`. |
| **3** | `requireUser` | `src/lib/auth/require-user.ts` | 15 | Invokes `await getSessionContext(customClient)`. |
| **4** | `getSessionContext` | `src/lib/auth/session.ts` | 61 | Obtains Supabase client: `customClient ?? (await createServerClient())`. |
| **5** | `createServerClient` | `src/lib/supabase/server.ts` | 13 | Calls `await cookies()` to obtain request cookies store. |
| **6** | `createSupabaseServerClient` | `@supabase/ssr/src/createServerClient.ts` | 155 | Initializes `SupabaseClient` with cookie adapter and `skipAutoInitialize: true`. |
| **7** | `getSessionContext` | `src/lib/auth/session.ts` | 66 | Calls `await supabase.auth.getUser()`. |
| **8** | `GoTrueClient.getUser` | `@supabase/auth-js/src/GoTrueClient.ts` | 3223 | Awaits `initializePromise` and dispatches `this._getUser()`. |
| **9** | `GoTrueClient._getUser` | `@supabase/auth-js/src/GoTrueClient.ts` | 3257 | Delegates to `this._useSession(...)`. |
| **10** | `GoTrueClient._useSession` | `@supabase/auth-js/src/GoTrueClient.ts` | 2971 | Executes `const result = await this.__loadSession()`. |
| **11** | `GoTrueClient.__loadSession` | `@supabase/auth-js/src/GoTrueClient.ts` | 3044 | Calls `getItemAsync(this.storage, this.storageKey)` to fetch session from cookies. |
| **12** | `GoTrueClient.__loadSession` | `@supabase/auth-js/src/GoTrueClient.ts` | **3067** | **Executes `currentSession.expires_at * 1000 - Date.now() < EXPIRY_MARGIN_MS`**. |
| **13** | `now` (wrapper) | `next/dist/server/node-environment-extensions/date.js` | 19 | Intercepts `Date.now()`; calls `io('`Date.now()`', 'time')`. |
| **14** | `io` | `next/dist/server/node-environment-extensions/io-utils.js` | 61–72 | Detects staged rendering context; flags Sync IO in non-dynamic stage. |
| **15** | `createSyncIORuntimeError` | `next/dist/server/app-render/sync-io-messages.js` | 51 | Formats error message with remediation guidance. |
| **16** | `applyOwnerStack` | `next/dist/server/dynamic-rendering-utils.js` | — | Attaches React Component Owner Stack pointing to `AccountantAppLayout`. |

---

## 4. Architectural Analysis: Why Next.js 16 Reports This Error

### 4.1 Staged Rendering Architecture in Next.js 16

In Next.js 16 with Cache Components (`cacheComponents: true`) and Partial Prefetching (`partialPrefetching: true`), rendering is structured into strictly ordered discrete stages defined in `node_modules/next/dist/server/app-render/staged-rendering.js`:

```typescript
enum RenderStage {
  Before = 1,
  
  // Static Stages (Static App Shell & Static Prefetch)
  ShellStatic = 10,
  PrefetchStatic_prefetchApi = 11,
  PrefetchStatic = 12,
  NavigationStatic = 13,
  Static = 14,
  
  // Runtime Stages (User Session Data & Runtime Prefetch)
  ShellRuntime = 20,
  PrefetchRuntime_prefetchApi = 21,
  PrefetchRuntime = 22,
  NavigationRuntime = 23,
  
  // Dynamic Stage (True Request Execution)
  Dynamic = 30,
  Abandoned = 40,
}
```

### 4.2 The Role of `partialPrefetching: true` and `SyncIOMode`

Next.js 16 controls synchronous IO enforcement through `SyncIOMode` (`staged-rendering.js:77-82`):

```javascript
var SyncIOMode = function(SyncIOMode) {
    /** Sync IO does not error in any stage. */
    SyncIOMode[SyncIOMode["Untracked"] = 1] = "Untracked";
    /** Before `partialPrefetching`: Sync IO errors in static stages, and is allowed otherwise. */
    SyncIOMode[SyncIOMode["AllowedInRuntimeOrDynamic"] = 2] = "AllowedInRuntimeOrDynamic";
    /** After `partialPrefetching`: Sync IO errors in all stages other than dynamic. */
    SyncIOMode[SyncIOMode["AllowedInDynamic"] = 3] = "AllowedInDynamic";
    return SyncIOMode;
}({});
```

When `partialPrefetching: true` is configured in `next.config.ts`:
1. Next.js activates **`SyncIOMode.AllowedInDynamic` (Mode 3)**.
2. In Mode 3, `shouldTrackSyncInterrupt()` (`staged-rendering.js:134-139`) evaluates to `true` for **all cacheable and prefetchable stages prior to Stage 30**:
   ```javascript
   case 3: {
       // Track sync IO in all cacheable stages.
       // This means all stages except:
       // - before the render
       // - in the dynamic stage
       return currentStage > 1 && currentStage < 30;
   }
   ```
3. Consequently, in `io-utils.js:64-73`:
   ```javascript
   case _stagedrendering.RenderStage.ShellRuntime:
   case _stagedrendering.RenderStage.PrefetchRuntime_prefetchApi:
   case _stagedrendering.RenderStage.PrefetchRuntime:
   case _stagedrendering.RenderStage.NavigationRuntime:
       {
           // We're in a runtime stage.
           // We only error for Sync IO in runtime stages if the route has partialPrefetching enabled.
           syncIOError = (0, _synciomessages.createSyncIORuntimeError)(workStore.route, expression, type);
           break;
       }
   ```
   Next.js explicitly states in its own engine source comments:
   > *"We're in a runtime stage. We only error for Sync IO in runtime stages if the route has partialPrefetching enabled."*

### 4.3 Owner Stack Attribution

Next.js 16 instruments React Server Component rendering with `applyOwnerStack()` (`dynamic-rendering-utils.js`). Because `Date.now()` is called synchronously inside `GoTrueClient.__loadSession()`, the JavaScript execution occurs synchronously within the microtask tick initiated by `AccountantAppLayout`.

React's owner stack tracks the active Server Component that scheduled or awaited the async tree. Because `AccountantAppLayout` is the component awaiting `requireFirmRole()`, Next.js maps the error frame directly to:
```
at AccountantAppLayout (src/app/(app)/app/layout.tsx:14)
```

---

## 5. Why `cookies()` Does Not Establish Dynamic Request Context (Question 4)

A central architectural question is: **Why does Next.js report that `Date.now()` was encountered during prerendering, even though `await cookies()` was executed before `Date.now()`?**

### 5.1 `cookies()` Maps to `sessionData` (`ShellRuntime`), Not `Dynamic`

In Next.js 16:
1. `cookies()` is categorized under `RENDER_STAGES_BY_DATA_KIND.sessionData`.
2. In `node_modules/next/dist/server/request/cookies.js:61-69`:
   ```javascript
   case 'prerender-runtime': {
       const { stagedRendering } = workUnitStore;
       if (stagedRendering) {
           return stagedRendering.delayUntilStage(
               _dynamicrenderingutils.RENDER_STAGES_BY_DATA_KIND.sessionData,
               'cookies',
               workUnitStore.cookies
           );
       } else {
           return makeUntrackedCookies(workUnitStore.cookies);
       }
   }
   ```
3. Staged rendering uses `delayUntilStage` to defer cookie resolution to `RenderStage.ShellRuntime` (Stage 20).
4. `ShellRuntime` allows reading user session cookies specifically so that an **authenticated static/runtime shell** can be computed and prefetched by the client router (`Partial Prefetching`).
5. However, **`ShellRuntime` is still a prerendering stage!** It is intended to produce cacheable, deterministic shell output for the navigation transition.
6. `Date.now()` is non-deterministic (it changes every millisecond). If a component in `ShellRuntime` reads `Date.now()`, the shell would bake in a stale millisecond timestamp or fail cache stability guarantees.
7. Therefore, Next.js requires that non-deterministic synchronous operations only run in `RenderStage.Dynamic` (Stage 30).

### 5.2 Transitioning to `RenderStage.Dynamic` Requires `connection()`

In Next.js 16:
- `cookies()` advances the render stage from `ShellStatic` (10) to `ShellRuntime` (20).
- `connection()` (`node_modules/next/dist/server/request/connection.js:87`) advances the render stage from `ShellRuntime` (20) to **`Dynamic` (Stage 30)**:
  ```javascript
  return (0, _dynamicrenderingutils.makeDevtoolsIOAwarePromise)(
      undefined,
      workUnitStore,
      _stagedrendering.RenderStage.Dynamic
  );
  ```
- Because neither `AccountantAppLayout` nor `getSessionContext()` invoked `await connection()`, execution remains in `ShellRuntime` (Stage 20).
- When `@supabase/auth-js` evaluates `Date.now()`, the render controller is in Stage 20, triggering `createSyncIORuntimeError`.

### 5.3 Static Prerendering Phase (`next build` / Static Shell Generation)

During static build prerendering (`workUnitStore.type === 'prerender'`):
1. In `node_modules/next/dist/server/request/cookies.js:51-52`:
   ```javascript
   case 'prerender':
       return makeHangingCookies(workStore, workUnitStore);
   ```
   `cookies()` returns a **hanging promise** (`makeSessionDataHangingPromise`) that never resolves, causing Server Components that await `cookies()` to suspend during static generation.
2. If `cookies()` is evaluated in a context where the promise does resolve (e.g. mock stores in tests or dev prefetch validation passes), `Date.now()` immediately triggers `abortOnSynchronousPlatformIOAccess` in `io-utils.js:28-34`:
   ```javascript
   case 'prerender':
   case 'prerender-runtime': {
       const prerenderSignal = workUnitStore.controller.signal;
       if (prerenderSignal.aborted === false) {
           (0, _dynamicrendering.abortOnSynchronousPlatformIOAccess)(
               workStore.route,
               expression,
               (0, _dynamicrenderingutils.applyOwnerStack)(
                   (0, _synciomessages.createSyncIOError)(workStore.route, expression, type)
               ),
               workUnitStore
           );
       }
       break;
   }
   ```
3. This aborts static generation and surfaces the warning/error.

### 5.4 The Role of `export const instant = false`

In `src/app/(app)/app/layout.tsx`:
```typescript
export const instant = false;
```
- Next.js 16 route segment config `instant = false` tells the Instant Navigation validator that navigations through this layout are allowed to block (i.e. they do not need to produce an instant prefetched shell).
- However, `instant = false` **does not disable staged rendering or Sync IO tracking** when `partialPrefetching: true` is enabled in `next.config.ts`.
- Next.js still executes the staged render pipeline to discover what portions of the route can be partially prefetched. When that staged pass runs, the runtime stage checks still execute and trigger the `Date.now()` warning.

---

## 6. Synthesis & Summary for Downstream Remediation Lanes

> [!NOTE]
> Per audit constraints, Lane A does not modify any code files. The architectural conclusions below are provided as formal findings for engineering hand-off.

1. **Exact Culprit**: `node_modules/@supabase/auth-js/src/GoTrueClient.ts:3067` (`dist/main/GoTrueClient.js:2541`):
   `currentSession.expires_at * 1000 - Date.now() < EXPIRY_MARGIN_MS`
2. **Execution Trigger**: `AccountantAppLayout` -> `requireFirmRole('staff')` -> `requireUser()` -> `getSessionContext()` -> `supabase.auth.getUser()` -> `GoTrueClient._useSession()` -> `GoTrueClient.__loadSession()`.
3. **Architectural Mechanics**:
   - `partialPrefetching: true` activates `SyncIOMode.AllowedInDynamic`.
   - `await cookies()` resolves at `RenderStage.ShellRuntime` (Stage 20), which is still subject to sync IO restrictions.
   - Without an explicit call to `await connection()` from `next/server` before auth evaluation, `Date.now()` executes in Stage 20 instead of Stage 30 (`Dynamic`).
   - Next.js 16's monkey-patched `Date.now` detects the call and generates `syncIORuntimeError`, attributing it via React's owner stack to `AccountantAppLayout`.

---
*Report completed and verified against Next.js 16.4.3 runtime internals and codebase dependencies.*
