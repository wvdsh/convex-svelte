<script lang="ts">
	const testRoutes = [
		{
			title: 'Always Errors',
			path: '/tests/always-errors',
			description: 'Tests error handling for queries that always throw'
		},
		{
			title: 'Async Query',
			path: '/tests/async-query',
			description: 'Tests async query behavior on the client'
		},
		{
			title: 'Async Query Error',
			path: '/tests/async-query-error',
			description: 'Tests error handling for async queries'
		},
		{
			title: 'Async Query SSR',
			path: '/tests/async-query-ssr',
			description: 'Tests async query behavior with server-side rendering'
		},
		{
			title: 'Auth',
			path: '/tests/auth',
			description: 'Tests authentication state management'
		},
		{
			title: 'Auth Clear',
			path: '/tests/auth-clear',
			description: 'Tests clearing authentication state'
		},
		{
			title: 'Auth No Setup',
			path: '/tests/auth-no-setup',
			description: 'Tests auth behavior without prior setup'
		},
		{
			title: 'Auth SSR',
			path: '/tests/auth-ssr',
			description: 'Tests authentication with server-side rendering'
		},
		{
			title: 'Paginated Query',
			path: '/tests/paginated-query',
			description: 'Tests paginated query loading and pagination controls'
		},
		{
			title: 'Paginated Query No SSR',
			path: '/tests/paginated-query-no-ssr',
			description: 'Tests paginated query without server-side rendering'
		},
		{
			title: 'Skip Query',
			path: '/tests/skip-query',
			description: 'Tests conditional query skipping behavior'
		},
		{
			title: 'SvelteKit Singleton',
			path: '/tests/sveltekit-singleton',
			description: 'Tests SvelteKit singleton pattern for Convex client'
		}
	];
</script>

<svelte:head>
	<title>Tests</title>
</svelte:head>

<div class="mx-auto max-w-2xl">
	<h1 class="mb-2 text-3xl font-bold text-gray-900">Tests</h1>
	<p class="mb-8 text-gray-600">All available test routes for convex-svelte</p>

	<section class="mb-10">
		<h2 class="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-800">
			<span class="h-2 w-2 rounded-full bg-purple-500"></span>
			Test Routes
		</h2>
		<div class="space-y-3">
			{#each testRoutes as route}
				<a
					href={route.path}
					class="block rounded-lg border border-purple-200 bg-white p-4 shadow transition-shadow hover:border-purple-400 hover:shadow-md"
				>
					<h3 class="text-lg font-semibold text-gray-900">{route.title}</h3>
					<p class="mt-1 text-sm text-gray-600">{route.description}</p>
					<span class="mt-2 inline-block text-xs text-purple-600">{route.path}</span>
				</a>
			{/each}
		</div>
	</section>

	<section class="rounded-lg border border-gray-200 bg-gray-100 p-4">
		<h3 class="mb-2 font-semibold text-gray-900">Run E2E Tests</h3>
		<p class="text-sm text-gray-600">
			Execute <code class="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs">pnpm test:e2e</code> to
			run all test scenarios with Playwright.
		</p>
	</section>
</div>
