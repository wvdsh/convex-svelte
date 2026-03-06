<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>ConvexHttpClient Test</title>
</svelte:head>

<h1>createConvexHttpClient Test</h1>
<p>Tests server-side data fetching using createConvexHttpClient in +page.server.ts</p>

<p data-testid="data">Loaded {data.messageCount} messages from server</p>

{#if data.messages.length > 0}
	<p data-testid="first-message">{data.messages[0].body}</p>
{/if}
