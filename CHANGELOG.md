# @mmailaender/convex-svelte

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
