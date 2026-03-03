<script lang="ts">
	import { usePaginatedQuery } from '$lib/use_paginated_query.svelte.js';
	import { api } from '../../../convex/_generated/api.js';

	let skipQuery = $state(false);

	const messages = usePaginatedQuery(
		api.messages.paginatedList,
		() => (skipQuery ? 'skip' : { muteWords: [] }),
		{
			initialNumItems: 3
		}
	);
</script>

<section>
	<h1>Paginated Query Test (No SSR)</h1>

	<div class="controls">
		<label>
			<input type="checkbox" bind:checked={skipQuery} data-testid="skip-checkbox" />
			Skip Query
		</label>
	</div>

	<div data-testid="query-state">
		{#if messages.isLoading}
			<p data-testid="loading">Loading</p>
		{:else if messages.error}
			<p data-testid="error">Error: {messages.error.message}</p>
		{:else if messages.results && messages.results.length > 0}
			<p data-testid="data">Results: {messages.results.length} messages</p>
		{:else}
			<p data-testid="no-data">No data</p>
		{/if}
	</div>

	<div data-testid="status-container">
		<p data-testid="status">Status: {messages.status}</p>
	</div>

	<div data-testid="results-container">
		{#if messages.results}
			<ul data-testid="results-list">
				{#each messages.results as message, i (message._id)}
					<li data-testid="result-item-{i}">
						<span data-testid="author-{i}">{message.author}</span>:
						<span data-testid="body-{i}">{message.body}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="actions">
		<button
			data-testid="load-more-btn"
			onclick={() => messages.loadMore(3)}
			disabled={messages.status !== 'CanLoadMore'}
		>
			Load More
		</button>

		<p data-testid="can-load-more">
			Can Load More: {messages.status === 'CanLoadMore' ? 'yes' : 'no'}
		</p>

		<p data-testid="is-exhausted">
			Is Exhausted: {messages.status === 'Exhausted' ? 'yes' : 'no'}
		</p>
	</div>
</section>

<style>
	section {
		padding: 1rem;
	}

	.controls {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.actions {
		margin-top: 1rem;
	}

	ul {
		list-style: none;
		padding: 0;
	}

	li {
		padding: 0.5rem 0;
		border-bottom: 1px solid #eee;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
