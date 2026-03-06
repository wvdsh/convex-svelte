> **Community Fork**: This is a community-maintained fork of the official [`convex-svelte`](https://github.com/get-convex/convex-svelte) package, published as `@mmailaender/convex-svelte`. It includes additional features like paginated queries and other community-requested improvements. This fork exists as an intermediate solution until the official package is updated.

[Convex](https://www.convex.dev/) is the typesafe backend-as-a-service with realtime updates, server functions, crons and scheduled jobs, file storage, vector search, and more.

[Quickstart](https://docs.convex.dev/quickstart/svelte)

# @mmailaender/convex-svelte

Receive live updates to Convex query subscriptions and call mutations and actions from Svelte with `@mmailaender/convex-svelte`.

## Table of Contents

- [Installation](#installation)
- [Setup](#setup)
- [Queries](#queries)
- [Async queries (experimental)](#async-queries-experimental)
- [Paginated queries](#paginated-queries)
- [Mutations](#mutations)
- [Actions](#actions)
- [Using the client outside components](#using-the-client-outside-components)
- [Authentication](#authentication)
- [Why server-side rendering?](#why-server-side-rendering)
- [Server-side rendering](#server-side-rendering)
- [SvelteKit integration](#sveltekit-integration)
- [Troubleshooting](#troubleshooting)
- [Deploying](#deploying)

## Installation

```bash
npm install convex @mmailaender/convex-svelte
```

Run `npx convex init` to get started with Convex.

See the [example app live](https://convex-svelte.vercel.app/).

## Setup

Call `setupConvex()` once in a root layout component (e.g. `+layout.svelte`). This initializes a [`ConvexClient`](https://docs.convex.dev/api/classes/browser.ConvexClient), stores it in Svelte context so child components can access it, and automatically closes the connection when the component is destroyed.

```svelte
<!-- +layout.svelte -->
<script lang="ts">
	import { setupConvex } from '@mmailaender/convex-svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';

	const client = setupConvex(PUBLIC_CONVEX_URL);
</script>
```

`setupConvex()` returns the `ConvexClient` instance directly, though you typically won't need it in the layout. In child components, use `useConvexClient()` to retrieve it from context.

You can pass [`ConvexClientOptions`](https://docs.convex.dev/api/interfaces/browser.ConvexClientOptions) as the second argument to configure the client.

## Queries

Use `useQuery()` to subscribe to a Convex query with automatic real-time updates. When the data changes on the server, your component re-renders automatically.

```svelte
<script lang="ts">
	import { useQuery } from '@mmailaender/convex-svelte';
	import { api } from '../../convex/_generated/api.js';

	const messages = useQuery(api.messages.list, () => ({ muteWords }), {
		keepPreviousData: true
	});
</script>

{#if messages.isLoading}
	Loading...
{:else if messages.error != null}
	failed to load: {messages.error.toString()}
{:else}
	<ul>
		{#each messages.data as message}
			<li>
				<span>{message.author}</span>
				<span>{message.body}</span>
			</li>
		{/each}
	</ul>
{/if}
```

The returned object is reactive and has the following shape:

| Property    | Type                 | Description                                                |
| ----------- | -------------------- | ---------------------------------------------------------- |
| `data`      | `T \| undefined`     | The query result, or `undefined` while loading             |
| `error`     | `Error \| undefined` | The error, if the query failed                             |
| `isLoading` | `boolean`            | `true` until the first result or error is received         |
| `isStale`   | `boolean`            | `true` when displaying cached data from previous arguments |

#### Options

- **`initialData`** — pre-loaded data for SSR/hydration, avoids the loading state (see [Server-side rendering](#server-side-rendering))
- **`keepPreviousData`** — when `true`, keeps displaying the previous result while new data loads after args change

### Skipping queries

You can conditionally skip a query by returning `'skip'` from the arguments function. This is useful when a query depends on some condition, like authentication state or user input.

```svelte
<script lang="ts">
	import { useQuery } from '@mmailaender/convex-svelte';
	import { api } from '../convex/_generated/api.js';

	let auth = $state({ isAuthenticated: true });

	const user = useQuery(api.users.queries.getActiveUser, () =>
		auth.isAuthenticated ? {} : 'skip'
	);
</script>

{#if user.isLoading}
	Loading user...
{:else if user.error}
	Error: {user.error}
{:else if user.data}
	Welcome, {user.data.name}!
{/if}
```

When a query is skipped, `isLoading` will be `false`, `error` will be `null`, and `data` will be `undefined`.

## Async queries (experimental)

Pass `{ async: true }` to `useQuery()` to return a `PromiseLike` that works with Svelte's `await` keyword and `<svelte:boundary>` for declarative loading and error states.

> **Note**: This requires Svelte's experimental async support. Add the following to your `svelte.config.js`:
>
> ```js
> compilerOptions: {
> 	experimental: {
> 		async: true;
> 	}
> }
> ```

```svelte
<script lang="ts">
	import { useQuery } from '@mmailaender/convex-svelte';
	import { api } from '../convex/_generated/api.js';

	const messages = useQuery(api.messages.list, () => ({ muteWords: [] }), { async: true });
	const user = useQuery(api.users.getActive, {}, { async: true });
</script>

<svelte:boundary>
	{#snippet pending()}
		<p>Loading...</p>
	{/snippet}

	{#snippet failed(error, reset)}
		<p>Something went wrong: {(error as Error).message}</p>
		<button onclick={reset}>Retry</button>
	{/snippet}

	{@const msgs = await messages}
	{@const me = await user}

	<h2>Welcome, {me.data.name}!</h2>
	<ul>
		{#each msgs.data as message}
			<li>{message.author}: {message.body}</li>
		{/each}
	</ul>
</svelte:boundary>
```

The `<svelte:boundary>` handles both loading and error states declaratively — no `{#if isLoading}` / `{:else if error}` / `{:else}` chains. Multiple queries can share a single boundary, so the `pending` snippet shows until **all** queries resolve.

**Error handling**: The boundary fully covers errors — both during the initial load (promise rejects → `failed` snippet) and after data has arrived (e.g. auth expiry, network issues). The `data` getter throws errors so the boundary catches them as rendering errors automatically. Clicking the `Retry` button re-renders the content, picking up recovered data if the subscription has reconnected.

**Loading states**: The boundary's `pending` snippet covers the initial load. For subsequent loading after reactive arg changes, the boundary does **not** re-enter `pending` (this is Svelte's design). Use `keepPreviousData: true` to display stale data during transitions, with `isStale` as a visual indicator:

```svelte
{@const result = await messages}

{#if result.isStale}
	<p>Updating...</p>
{/if}

<ul>
	{#each result.data as message}
		<li>{message.author}: {message.body}</li>
	{/each}
</ul>
```

### When to use async vs sync

- **Use `useQuery()` (default sync)** when you want inline control over loading/error states, or need to render partial UI while data loads.
- **Use `useQuery()` with `{ async: true }`** when you want boundary-based loading/error handling with less markup. This shines when grouping multiple queries under a single boundary. With Svelte 6's async renderer, this will also enable SSR without `+page.server.ts` boilerplate.

All options (`initialData`, `keepPreviousData`, `skip`) work in both modes.

## Paginated queries

For queries that return large datasets, use `usePaginatedQuery()` to load results incrementally. This hook manages cursor-based pagination automatically and provides a `loadMore` function to fetch additional pages.

```svelte
<script lang="ts">
	import { usePaginatedQuery } from '@mmailaender/convex-svelte';
	import { api } from '../../convex/_generated/api.js';

	const paginatedMessages = usePaginatedQuery(api.messages.listPaginated, () => ({}), {
		initialNumItems: 10
	});
</script>

{#if paginatedMessages.isLoading}
	Loading...
{:else if paginatedMessages.error}
	Error: {paginatedMessages.error.toString()}
{:else}
	<ul>
		{#each paginatedMessages.results as message}
			<li>
				<span>{message.author}</span>
				<span>{message.body}</span>
			</li>
		{/each}
	</ul>
	{#if paginatedMessages.status === 'CanLoadMore'}
		<button onclick={() => paginatedMessages.loadMore(10)}>Load more</button>
	{/if}
{/if}
```

#### Options

- **`initialNumItems`** (required) — number of items to load on the first page
- **`initialData`** — optional initial data for SSR/hydration
- **`keepPreviousData`** — when `true`, keeps previous results visible while loading new data after args change

You can also skip a paginated query by returning `'skip'` from the arguments function, just like with `useQuery()`.

```svelte
<script lang="ts">
	import { usePaginatedQuery } from '@mmailaender/convex-svelte';
	import { api } from '../../convex/_generated/api.js';

	let searchTerm = $state('');

	const searchResults = usePaginatedQuery(
		api.messages.search,
		() => (searchTerm.length > 0 ? { query: searchTerm } : 'skip'),
		{ initialNumItems: 20, keepPreviousData: true }
	);
</script>
```

## Mutations

Use `useConvexClient()` in any child component to get the [`ConvexClient`](https://docs.convex.dev/api/classes/browser.ConvexClient) and call mutations. Mutations return a `Promise` with the result.

```svelte
<script lang="ts">
	import { useConvexClient } from '@mmailaender/convex-svelte';
	import { api } from '../../convex/_generated/api.js';

	const client = useConvexClient();

	let toSend = $state('');
	let author = $state('me');

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		const data = Object.fromEntries(new FormData(event.target as HTMLFormElement).entries());
		client.mutation(api.messages.send, {
			author: data.author as string,
			body: data.body as string
		});
	}
</script>

<form onsubmit={handleSubmit}>
	<input type="text" name="author" bind:value={author} />
	<input type="text" name="body" bind:value={toSend} />
	<button type="submit" disabled={!toSend}>Send</button>
</form>
```

### Optimistic updates

Optimistic updates let you update the UI immediately when a mutation is called, without waiting for the server to respond. Pass an `optimisticUpdate` callback in the mutation options to update the local query cache.

```svelte
<script lang="ts">
	import { useConvexClient } from '@mmailaender/convex-svelte';
	import { api } from '../../convex/_generated/api.js';

	const client = useConvexClient();

	async function updateUser() {
		await client.mutation(
			api.user.update,
			{ name: 'John Doe' },
			{
				optimisticUpdate: (store) => {
					store.setQuery(api.user.get, {}, { name: 'John Doe' });
				}
			}
		);
	}
</script>
```

Inside the `optimisticUpdate` callback, use `store.setQuery()` to update the local cache for a specific query. The arguments are:

1. **Query reference** — the query to update (e.g. `api.user.get`)
2. **Query arguments** — must match the arguments used by the active `useQuery()` subscription
3. **New value** — the optimistic data to display immediately

If the mutation fails, the optimistic update is automatically rolled back and the UI reverts to the server state.

## Actions

Actions are similar to mutations but can have side effects like calling third-party APIs. Use the same `useConvexClient()` to call them.

```svelte
<script lang="ts">
	import { useConvexClient } from '@mmailaender/convex-svelte';
	import { api } from '../../convex/_generated/api.js';

	const client = useConvexClient();

	async function generateUploadUrl() {
		const uploadUrl = await client.action(api.files.generateUploadUrl, {});
	}
</script>
```

## Using the client outside components

### `useConvexClient()` vs `getConvexClient()`

`useConvexClient()` retrieves the client from **Svelte context** via `getContext()`. This means it only works during component initialization — inside `.svelte` files or code called synchronously from a component's `<script>` block.

`getConvexClient()` retrieves the client from a **module-level singleton**. It works anywhere — plain `.ts` utility files, service layers, async callbacks — as long as `setupConvex()` (or `initConvex()`) has been called first.

| | `useConvexClient()` | `getConvexClient()` |
|---|---|---|
| **Import** | `@mmailaender/convex-svelte` | `@mmailaender/convex-svelte` |
| **Works in** | Svelte components only | Anywhere (`.ts`, `.svelte`, hooks) |
| **Mechanism** | Svelte `getContext()` | Module singleton |
| **Requires** | `setupConvex()` in parent | `setupConvex()` or `initConvex()` called first |

### Calling mutations from utility files

Keep business logic in separate `.ts` files and use `getConvexClient()` to access the Convex client:

```ts
// src/lib/services/tasks.ts
import { getConvexClient } from '@mmailaender/convex-svelte';
import { api } from '../convex/_generated/api.js';

export async function createTask(text: string) {
	const client = getConvexClient();
	await client.mutation(api.tasks.create, { text });
}

export async function completeTask(id: string) {
	const client = getConvexClient();
	await client.mutation(api.tasks.complete, { id });
}
```

Then call these functions from any component without plumbing the client through:

```svelte
<script lang="ts">
	import { createTask } from '$lib/services/tasks.js';

	let text = $state('');
</script>

<form onsubmit={(e) => { e.preventDefault(); createTask(text); text = ''; }}>
	<input bind:value={text} />
	<button type="submit">Add</button>
</form>
```

> **Note**: The `.svelte.ts` file extension enables Svelte 5 runes (`$state`, `$derived`, `$effect`) but does **not** make `getContext()` work outside components. If you need the client in a plain `.ts` file, use `getConvexClient()`, not `useConvexClient()`.

## Authentication

### setupAuth / useAuth

`setupAuth()` accepts a **reactive getter** returning the auth provider's state and automatically manages `client.setAuth()` / `client.clearAuth()`. This mirrors React's `ConvexProviderWithAuth` — when the provider state changes (sign-in, sign-out, token refresh), the auth lifecycle updates automatically.

```svelte
<!-- +layout.svelte -->
<script lang="ts">
	import { setupConvex, setupAuth } from '@mmailaender/convex-svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';

	setupConvex(PUBLIC_CONVEX_URL);

	// The getter is reactive — when its return values change,
	// setupAuth automatically toggles setAuth/clearAuth.
	setupAuth(() => ({
		isLoading: false,
		isAuthenticated: !!session,
		fetchAccessToken: async ({ forceRefreshToken }) => {
			if (!session) return null;
			return await getTokenFromYourAuthProvider({ forceRefreshToken });
		}
	}));
</script>
```

`useAuth()` reads the resulting state in any child component:

```svelte
<script lang="ts">
	import { useAuth, useQuery } from '@mmailaender/convex-svelte';
	import { api } from '../convex/_generated/api.js';

	const auth = useAuth();

	const user = useQuery(api.users.getActive, () => (auth.isAuthenticated ? {} : 'skip'));
</script>

{#if auth.isLoading}
	Checking authentication...
{:else if !auth.isAuthenticated}
	Please sign in.
{:else}
	Welcome, {user.data?.name}!
{/if}
```

When the auth provider's `isAuthenticated` changes from `true` to `false` (user signs out), the internal `$effect` re-runs, calls `clearAuth()` automatically, and `useAuth().isAuthenticated` updates to `false`. No manual cleanup needed.

#### SSR initial state

Pass `initialState` to seed the server render before any client-side `$effect` runs:

```svelte
<script lang="ts">
	import { setupConvex, setupAuth } from '@mmailaender/convex-svelte';

	let { data } = $props(); // from +layout.server.ts

	setupConvex(PUBLIC_CONVEX_URL);
	setupAuth(
		() => ({
			isLoading: session.isPending,
			isAuthenticated: !!session.data,
			fetchAccessToken: async ({ forceRefreshToken }) => getToken({ forceRefreshToken })
		}),
		{ initialState: { isAuthenticated: data.isAuthenticated } }
	);
</script>
```

The server state is trusted until the client-side auth flow settles, then the client takes over.

### Auth adapters

For a complete authentication setup with Better Auth, see [`@mmailaender/convex-better-auth-svelte`](https://github.com/mmailaender/convex-better-auth-svelte). Its `createSvelteAuthClient()` calls `setupAuth()` internally with a reactive session getter, so `useAuth()` from either package works.

### Low-level: client.setAuth()

You can also use `client.setAuth()` directly for custom integrations:

```svelte
<script lang="ts">
	import { useConvexClient } from '@mmailaender/convex-svelte';

	const client = useConvexClient();

	client.setAuth(
		async () => {
			return await getAuthToken();
		},
		(isAuthenticated) => {
			console.log('Auth state changed:', isAuthenticated);
		}
	);
</script>
```

## Why server-side rendering?

With a realtime backend like Convex, you might wonder whether SSR is worth the effort — after all, the client will open a WebSocket and get live updates anyway. The short answer: **SSR with Convex is almost always faster for time-to-data on first page load.**

### The client-side waterfall

Without SSR, every first page load hits a sequential waterfall:

```
1. Client → Framework server: request page
2. Framework server → Client: HTML shell (empty)        ← skeleton visible
3. Browser parses HTML, discovers <script> tags
4. Browser downloads JavaScript bundle(s)
5. Browser parses + executes JavaScript                  ← 50-200ms on mobile
6. Framework boots, component mounts, useQuery() fires
7. Client → Convex: subscribe to query
8. Convex → Client: data                                ← content visible
```

Steps 3–6 are **dead time** — the user is staring at a skeleton while the browser downloads and executes JS before it can even *start* talking to Convex.

### SSR eliminates the waterfall

With SSR, your framework server fetches data from Convex while rendering the page. The client receives complete HTML with data in a single response:

```
1. Client → Framework server: request page
2. Server → Convex: fetch data                           ← ~1-5ms if co-located
3. Server renders HTML with data
4. Framework server → Client: complete HTML + data       ← content visible
5. Browser hydrates (attaches event listeners)
6. Client → Convex: WebSocket for live updates           ← background, non-blocking
```

The server uses the time the client would be waiting anyway (for the HTTP response) to productively fetch data. Steps 2–3 happen **inside** the server response time, not after it.

### How much faster?

The difference depends on three factors:

**Device speed** — The biggest variable. On a mid-range mobile phone, JS parse + execute (steps 3–6 in the waterfall) takes 100–300ms. On desktop, 30–80ms. SSR skips this entirely.

**Server-to-Convex distance** — If your framework server is co-located with Convex (same cloud region), the server→Convex hop is ~1–5ms. This is essentially free. Convex currently offers **US East (N. Virginia)** and **EU West (Ireland)** regions.

**Client-to-server distance** — Both approaches need at least one round trip to the framework server. SSR bundles data into that response; client-side adds a second round trip to Convex after JS execution.

A realistic example (user in Germany, framework server in EU, Convex in Ireland):

| | SSR | Client-side |
|---|---|---|
| Skeleton/shell visible | — | ~20ms |
| **Content with data visible** | **~70ms** | **~200–400ms** |
| Live updates active | ~150ms (background) | ~200–400ms |

### Co-locate your server with Convex

The single biggest optimization: **deploy your framework server in the same region as Convex.**

| Platform | How to co-locate with Convex |
|---|---|
| **Vercel** | Set function region to `iad1` (US East) or `dub1` (Ireland) in project settings — default is `iad1` |
| **Cloudflare** | Enable [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement/) or set explicit placement to match your Convex region |
| **Netlify** | Use [region selection](https://www.netlify.com/blog/netlify-functions-region-selection/) to match your Convex region |

With co-location, the server→Convex hop is negligible (~1–5ms), and SSR becomes strictly faster than client-side for time-to-data.

### SSR is easy with the SvelteKit transport hook

A common concern is that SSR adds boilerplate. With the [`convexLoad` transport hook](#convexload--ssr-with-live-upgrade), it's minimal — fetch in your load function, use the result directly in the template. No manual `initialData` wiring needed:

```ts
// +page.ts
export const load = async () => ({
	tasks: await convexLoad(api.tasks.get, {})
});
```

The result is a live-updating reactive object that works without `useQuery()` in the component. SSR on first load, live WebSocket updates after hydration — all handled automatically.

### When is client-side rendering acceptable?

SSR delivers a better experience in virtually every scenario. Client-side rendering is not *faster* — it just shows a skeleton sooner while the user waits longer for actual data. That said, skipping SSR is acceptable when:

- **Authenticated app-like UIs** (dashboards, admin panels) — users have longer sessions where the one-time initial load cost is amortized, and SEO is irrelevant
- **Rapid prototyping** — when you want to iterate quickly and add SSR later

Even in these cases, SSR would still provide a faster first load. The trade-off is development effort, not performance.

Note that **subsequent navigations are always client-side** regardless of your SSR choice. After the initial page load, SvelteKit does client-side routing and the Convex WebSocket is already open — data loads without any framework server round trip.

> **Recommendation:** Default to SSR. It is faster for time-to-data in every realistic deployment, and with the transport hook it requires minimal effort. Only skip SSR if you have a specific reason to.

## Server-side rendering

Both `useQuery()` and `usePaginatedQuery()` accept an `initialData` option. By pre-loading data in a `+page.server.ts` load function using `ConvexHttpClient` and passing it as `initialData`, you can avoid the initial loading state.

```ts
// +page.server.ts
import { ConvexHttpClient } from 'convex/browser';
import type { PageServerLoad } from './$types.js';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '../convex/_generated/api.js';

export const load = (async () => {
	const client = new ConvexHttpClient(PUBLIC_CONVEX_URL!);
	return {
		messages: await client.query(api.messages.list, { muteWords: [] })
	};
}) satisfies PageServerLoad;
```

```svelte
<script lang="ts">
	// +page.svelte
	import type { PageData } from './$types.js';
	let { data }: { data: PageData } = $props();

	import { useQuery } from '@mmailaender/convex-svelte';
	import { api } from '../convex/_generated/api.js';

	const messages = useQuery(
		api.messages.list,
		() => ({ muteWords: [] }),
		() => ({ initialData: data.messages })
	);
</script>
```

Combining `initialData` with `keepPreviousData: true` (or never changing the query arguments) should be enough to avoid ever seeing a loading state.

## SvelteKit integration

Import from `@mmailaender/convex-svelte/sveltekit` for SvelteKit-specific features: module-level client singleton, SSR transport with live upgrade, and a server-side HTTP client helper.

### initConvex — early client init

Call `initConvex()` in `hooks.client.ts` to create the `ConvexClient` before any component mounts. This is required for `transport.decode` to work (it runs before component hydration).

```ts
// hooks.client.ts
import { initConvex } from '@mmailaender/convex-svelte/sveltekit';
import { PUBLIC_CONVEX_URL } from '$env/static/public';

initConvex(PUBLIC_CONVEX_URL);
```

`setupConvex()` in your root layout automatically reuses the singleton created by `initConvex()`, so only one `ConvexClient` instance exists.

### convexLoad — SSR with live upgrade

`convexLoad()` fetches data on the server and automatically upgrades to a live subscription on the client. No manual `initialData` wiring needed.

```ts
// +page.ts (universal load function)
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';

export const load = async () => ({
	tasks: await convexLoad(api.tasks.get, {})
});
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
	let { data } = $props();
	const tasks = $derived(data.tasks);
</script>

{#if tasks.isLoading}
	Loading...
{:else if tasks.error}
	Error: {tasks.error.message}
{:else}
	<ul>
		{#each tasks.data as task}
			<li>{task.text}</li>
		{/each}
	</ul>
{/if}
```

For authenticated server-side fetches, pass a token:

```ts
export const load = async ({ locals }) => ({
	tasks: await convexLoad(api.tasks.get, {}, { token: locals.token })
});
```

#### Transport hook

Register the transport hook in `hooks.ts` so SvelteKit can serialize/deserialize `ConvexLoadResult` across the SSR boundary:

```ts
// hooks.ts
import { encodeConvexLoad, decodeConvexLoad } from '@mmailaender/convex-svelte/sveltekit';

export const transport = {
	ConvexLoadResult: {
		encode: encodeConvexLoad,
		decode: decodeConvexLoad
	}
};
```

### createConvexHttpClient — server helpers

For server-only code (`+page.server.ts`, form actions, API routes), use `createConvexHttpClient()`:

```ts
// +page.server.ts
import { createConvexHttpClient } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';

export const load = async ({ locals }) => {
	const client = createConvexHttpClient({ token: locals.token });
	const tasks = await client.query(api.tasks.get, {});
	return { tasks };
};
```

The `url` option falls back to the URL set by `initConvex()`. Pass `token` for authenticated requests.

## Troubleshooting

#### effect_in_teardown Error

If you encounter `effect_in_teardown` errors when using `useQuery` in components that can be conditionally rendered (like dialogs, modals, or popups), this is caused by wrapping `useQuery` in a `$derived` block that depends on reactive state.

When `useQuery` is wrapped in `$derived`, state changes during component cleanup can trigger re-evaluation of the `$derived`, which attempts to create a new `useQuery` instance. Since `useQuery` internally creates a `$effect`, and effects cannot be created during cleanup, this throws an error.

Use [Skipping queries](#skipping-queries) instead. By calling `useQuery` unconditionally at the top level and passing a function that returns `'skip'`, the function is evaluated inside `useQuery`'s own effect tracking, preventing query recreation during cleanup.

#### Missing `setupConvex()` Error

If you see `No ConvexClient was found in Svelte context`, make sure `setupConvex()` is called in a parent layout or component (e.g. `+layout.svelte`) before any child component calls `useQuery()` or `useConvexClient()`.

#### String query names

Query references must be `api.*` function references, not plain strings. If you pass a string like `"messages.list"`, you will get an error. Always import and use `api` from your generated API.

## Deploying

In production build pipelines use the build command

```bash
npx convex deploy --cmd-url-env-var-name PUBLIC_CONVEX_URL --cmd 'npm run build'
```

to build your Svelte app and deploy Convex functions.
