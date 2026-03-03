<script lang="ts">
	import { useQuery } from '$lib/client.svelte.js';
	import { api } from '../../../convex/_generated/api.js';

	const foo = useQuery(api.messages.error, {});

	// Extract individual properties so the discriminated union doesn't narrow
	// cross-property checks to `never`. This test page intentionally validates
	// that impossible runtime states never occur.
	const fooData = $derived(foo.data);
	const fooError = $derived(foo.error);
	const fooIsLoading = $derived(foo.isLoading);

	function fail(msg: string) {
		setTimeout(() => {
			throw new Error(msg);
		}, 0);
		return msg;
	}
</script>

<section>
	<h1>This query always errors</h1>

	{#if fooData}
		<p>query has data.</p>
	{/if}
	{#if fooError}
		<p>query errored.</p>
	{/if}
	{#if fooIsLoading}
		<p>query is loading.</p>
	{/if}
	{#if fooError && fooIsLoading}
		<p>{fail('query errored and is loading. (impossible state unless useStale were true)')}</p>
	{/if}
	{#if fooData && fooIsLoading}
		<p>{fail('query has data and is loading. (impossible state unless useStale were true)')}</p>
	{/if}
	{#if fooData && fooError}
		<p>query errored and has data. (impossible state)</p>
	{/if}
	{#if !fooIsLoading && !fooError && !fooData}
		<p>{fail('query is not loading and did not error and has no data. (impossible state)')}</p>
	{/if}
	{#if fooIsLoading && fooError && fooData}
		<p>{fail('query is loading and has error and has data. (impossible state)')}</p>
	{/if}

	{#if fooError}<p>error message:</p>
		<code><pre> {fooError.message} </pre></code>
	{/if}
</section>
