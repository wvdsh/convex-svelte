<script lang="ts">
	import { useQuery } from '$lib/client.svelte.js';
	import { api } from '../../../convex/_generated/api.js';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	const result = useQuery(
		api.messages.list,
		() => ({ muteWords: [] }),
		() => ({ async: true as const, initialData: data.messages })
	);
</script>

<section class="space-y-4">
	<h1 class="text-2xl font-bold text-gray-900">Async Query SSR Test</h1>

	<div data-testid="initial-data-info" class="rounded-lg border border-gray-200 bg-gray-50 p-3">
		<p class="text-sm text-gray-600">Initial data count: {data.messages?.length ?? 0}</p>
	</div>

	<svelte:boundary>
		{#snippet pending()}
			<p data-testid="pending" class="text-sm text-blue-600">Loading...</p>
		{/snippet}

		{#snippet failed(error, reset)}
			<p data-testid="error" class="text-sm text-red-700">Error: {(error as Error).message}</p>
			<button
				onclick={reset}
				data-testid="reset-btn"
				class="rounded bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-300"
				>Retry</button
			>
		{/snippet}

		{@const res = await result}

		<div data-testid="query-state" class="rounded-lg border border-gray-200 bg-gray-50 p-4">
			{#if res.data}
				<p data-testid="data" class="text-sm text-green-700">Data: {res.data.length} messages</p>
			{:else}
				<p data-testid="no-data" class="text-sm text-gray-500">No data</p>
			{/if}
		</div>
	</svelte:boundary>
</section>
