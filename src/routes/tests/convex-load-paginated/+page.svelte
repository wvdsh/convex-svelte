<script lang="ts">
	import { useConvexClient } from '$lib/index.js';
	import { browser } from '$app/environment';
	import { api } from '../../../convex/_generated/api.js';

	let { data } = $props();

	const client = useConvexClient();
	const messages = $derived(data.messages);

	const TEST_AUTHOR = '__e2e_convex_load_paginated_test__';
	let sent = $state(false);
	let cleaned = $state(false);
	let mutationError = $state('');
	let hydrated = $derived(browser);

	async function sendTestMessage() {
		try {
			await client.mutation(api.messages.send, {
				author: TEST_AUTHOR,
				body: 'Hello from convexLoadPaginated e2e test'
			});
			sent = true;
		} catch (e) {
			mutationError = String(e);
		}
	}

	async function cleanup() {
		try {
			await client.mutation(api.messages.deleteByAuthor, {
				author: TEST_AUTHOR
			});
			cleaned = true;
		} catch (e) {
			mutationError = String(e);
		}
	}

	const testMessageExists = $derived(
		messages.results?.some((m: { author: string }) => m.author === TEST_AUTHOR) ?? false
	);
</script>

<svelte:head>
	<title>ConvexLoadPaginated Test</title>
</svelte:head>

<h1>ConvexLoadPaginated SSR Transport Test</h1>

<div>
	<button data-testid="send-btn" onclick={sendTestMessage}>Send Message</button>
	<button data-testid="cleanup-btn" onclick={cleanup}>Cleanup</button>
	<button
		data-testid="load-more-btn"
		onclick={() => messages.loadMore(3)}
		disabled={messages.status !== 'CanLoadMore'}
	>
		Load More
	</button>
</div>

<p data-testid="hydrated">hydrated: {hydrated}</p>
<p data-testid="sent">sent: {sent}</p>
<p data-testid="cleaned">cleaned: {cleaned}</p>
<p data-testid="test-message-exists">testMessageExists: {testMessageExists}</p>
<p data-testid="mutation-error">mutationError: {mutationError}</p>
<p data-testid="status">status: {messages.status}</p>
{#if messages.isLoading}
	<p data-testid="loading">Loading...</p>
{:else if messages.error}
	<p data-testid="error">{messages.error.message}</p>
{:else}
	<p data-testid="data">Loaded {messages.results?.length ?? 0} messages</p>
	<ul data-testid="results-list">
		{#each messages.results as message, i (message._id)}
			<li data-testid="result-item-{i}">
				<span data-testid="author-{i}">{message.author}</span>:
				<span data-testid="body-{i}">{message.body}</span>
			</li>
		{/each}
	</ul>
{/if}
