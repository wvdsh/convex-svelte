<script lang="ts">
	import { useQuery } from '$lib/client.svelte.js';
	import { api } from '../../../convex/_generated/api.js';

	let skipQuery = $state(false);

	const result = useQuery(api.messages.list, () => (skipQuery ? 'skip' : { muteWords: [] }), {
		async: true
	});
</script>

<section class="space-y-4">
	<h1 class="text-2xl font-bold text-gray-900">Async Query Test</h1>

	<label class="inline-flex items-center gap-2 text-sm text-gray-700">
		<input
			type="checkbox"
			bind:checked={skipQuery}
			data-testid="skip-checkbox"
			class="rounded border-gray-300"
		/>
		Skip Query
	</label>

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
			{#if res.isStale}
				<p data-testid="is-stale" class="mt-1 text-xs text-amber-600">Stale data</p>
			{/if}
		</div>
	</svelte:boundary>
</section>
