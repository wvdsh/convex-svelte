# @mmailaender/convex-svelte

## 0.17.1

### Patch Changes

- Fix: Use authenticated singleton ConvexClient for client-side initial fetches in `convexLoad()` and `convexLoadPaginated()` instead of creating new HTTP clients

## 0.17.0

### Minor Changes

- Features:
  - **`useMutation()`** / **`useAction()`** — thin wrappers that return callable functions for mutations and actions. They work in `.svelte` components and plain `.ts` / `.js` files.

## 0.16.0

### Minor Changes

- Features:
  - **`convexLoadPaginated()`** — SSR-compatible paginated query loading. Fetches the first page on the server and automatically upgrades to a live paginated subscription on the client, with `loadMore()` support for incremental loading. Works with the SvelteKit transport hook, mirroring the `convexLoad()` pattern for paginated queries.

- Fixes:
  - Add deferred subscription queue to prevent auth gap between transport.decode and setupAuth

## 0.15.4

### Patch Changes

- fix: Add `isLoading`, `error`, and `isStale` properties to `ConvexLoadResult` for consistent query state interface

## 0.15.3

### Patch Changes

- fix: prevent flash of `null` query results during SSR hydration
  - Call `client.setAuth()` synchronously during `setupAuth()` initialization (before any `$effect` runs) when SSR confirms authentication. The Convex client's `AuthenticationManager` pauses the WebSocket during token fetch, preventing child `useQuery` subscriptions from hitting an unauthenticated WebSocket and overriding `initialData` with `null`.
  - Add a hydration guard in the reactive `$effect`: while the synchronous `setAuth` is active, skip all state transitions and avoid a redundant `client.setAuth()` call. Calling `setAuth` a second time triggers `setConfig` → `_pauseSocket()`, which closes and reopens the WebSocket — causing subscriptions to briefly receive `null` for auth-gated queries.

## 0.15.1

### Patch Changes

- Improvements
  - Expose `UsePaginatedQuery` types and consolidate API reference table with type exports

## 0.15.0

### Minor Changes

- Features:
  - **Authentication** — `setupAuth()` and `useAuth()` for reactive auth state management, mirroring React's `ConvexProviderWithAuth` pattern. Includes SSR hydration via `initialState` option.
  - **getConvexClient()** — retrieves the Convex client from a module-level singleton, working anywhere (`.ts`, `.svelte`, hooks) as long as `setupConvex()` has been called first.
  - **SvelteKit subpath** (`convex-svelte/sveltekit`) — new export with SvelteKit-specific features:
    - `convexLoad()` — SSR data fetching that auto-upgrades to live subscriptions on the client
    - `createConvexHttpClient()` — server-side HTTP client helper with auth token support
    - `getConvexUrl()` — retrieve the deployment URL set by `initConvex()` or `setupConvex()`
  - **Client singleton** — `getConvexClient()` for accessing the `ConvexClient` from anywhere (`.ts` files, utility modules, hooks), not just Svelte components

- Improvements:
  - Restructured README with expanded installation guide, client access patterns, SSR performance rationale, and API reference

## 0.14.0

### Minor Changes

- Features:
  - Add experimental async query support with Svelte boundary integration
