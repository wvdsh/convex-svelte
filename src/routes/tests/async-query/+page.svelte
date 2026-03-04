<script lang="ts">
	import { useQuery } from '$lib/client.svelte.js';
	import { api } from '../../../convex/_generated/api.js';

	let skipQuery = $state(false);

	const result = useQuery(api.messages.list, () => (skipQuery ? 'skip' : { muteWords: [] }), {
		async: true
	});
</script>

<section>
	<h1>Async Query Test</h1>

	<label>
		<input type="checkbox" bind:checked={skipQuery} data-testid="skip-checkbox" />
		Skip Query
	</label>

	<svelte:boundary>
		{#snippet pending()}
			<p data-testid="pending">Loading...</p>
		{/snippet}

		{#snippet failed(error, reset)}
			<p data-testid="error">Error: {(error as Error).message}</p>
			<button onclick={reset} data-testid="reset-btn">Retry</button>
		{/snippet}

		{@const res = await result}

		<div data-testid="query-state">
			{#if res.data}
				<p data-testid="data">Data: {res.data.length} messages</p>
			{:else}
				<p data-testid="no-data">No data</p>
			{/if}
			{#if res.isStale}
				<p data-testid="is-stale">Stale data</p>
			{/if}
		</div>
	</svelte:boundary>
</section>
