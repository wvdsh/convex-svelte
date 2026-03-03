> **Community Fork**: This is a community-maintained fork of the official [`convex-svelte`](https://github.com/get-convex/convex-svelte) package, published as `@mmailaender/convex-svelte`. It includes additional features like paginated queries and other community-requested improvements. This fork exists as an intermediate solution until the official package is updated.

[Convex](https://www.convex.dev/) is the typesafe backend-as-a-service with realtime updates, server functions, crons and scheduled jobs, file storage, vector search, and more.

[Quickstart](https://docs.convex.dev/quickstart/svelte)

# @mmailaender/convex-svelte

Receive live updates to Convex query subscriptions and call mutations and actions from Svelte with `@mmailaender/convex-svelte`.

## Table of Contents

- [Installation](#installation)
- [Setup](#setup)
- [Queries](#queries)
- [Paginated queries](#paginated-queries)
- [Mutations](#mutations)
- [Actions](#actions)
- [Authentication](#authentication)
- [Server-side rendering](#server-side-rendering)
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

## Authentication

Use `client.setAuth()` to configure authentication. The token fetcher is called automatically when the token expires.

```svelte
<script lang="ts">
	import { useConvexClient } from '@mmailaender/convex-svelte';

	const client = useConvexClient();

	client.setAuth(
		async () => {
			// Return your JWT token (e.g. from an auth provider)
			return await getAuthToken();
		},
		(isAuthenticated) => {
			console.log('Auth state changed:', isAuthenticated);
		}
	);
</script>
```

For a complete authentication setup, see [Convex Better Auth UI](https://github.com/mmailaender/Convex-Better-Auth-UI).

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
