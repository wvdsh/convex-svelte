<script lang="ts">
	import { useAuth } from '$lib/index.js';

	let errorMessage = $state('');

	try {
		useAuth();
	} catch (e) {
		errorMessage = e instanceof Error ? e.message : String(e);
	}
</script>

<section>
	<h1>Auth No Setup Test</h1>

	{#if errorMessage}
		<p data-testid="error">{errorMessage}</p>
	{:else}
		<p data-testid="no-error">No error thrown</p>
	{/if}
</section>
