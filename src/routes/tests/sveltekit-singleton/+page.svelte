<script lang="ts">
	import { useQuery } from '$lib/index.js';
	import { api } from '../../../convex/_generated/api.js';

	const messages = useQuery(api.messages.list, { muteWords: [] });
</script>

<section>
	<h1>SvelteKit Singleton Test</h1>

	<div data-testid="query-state">
		{#if messages.isLoading}
			<p data-testid="loading">Loading</p>
		{:else if messages.error}
			<p data-testid="error">Error: {messages.error.message}</p>
		{:else if messages.data}
			<p data-testid="data">Data: {messages.data.length} messages</p>
		{:else}
			<p data-testid="no-data">No data</p>
		{/if}
	</div>
</section>
