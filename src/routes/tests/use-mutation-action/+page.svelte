<script lang="ts">
	import { useMutation, useQuery } from '$lib/index.js';
	import { api } from '../../../convex/_generated/api.js';

	const sendMessage = useMutation(api.messages.send);
	const deleteByAuthor = useMutation(api.messages.deleteByAuthor);

	const TEST_AUTHOR = '__e2e_use_mutation_test__';

	const messages = useQuery(api.messages.list, () => ({ muteWords: [] }));

	let sent = $state(false);
	let cleaned = $state(false);

	async function sendTestMessage() {
		await sendMessage({
			author: TEST_AUTHOR,
			body: 'Hello from useMutation e2e test'
		});
		sent = true;
	}

	async function cleanup() {
		await deleteByAuthor({ author: TEST_AUTHOR });
		cleaned = true;
	}

	const testMessage = $derived(messages.data?.find((m) => m.author === TEST_AUTHOR));
	const testMessageExists = $derived(!!testMessage);
</script>

<svelte:head>
	<title>useMutation / useAction Test</title>
</svelte:head>

<h1>useMutation / useAction Test</h1>

<div>
	<button data-testid="send-btn" onclick={sendTestMessage}>Send Message</button>
	<button data-testid="cleanup-btn" onclick={cleanup}>Cleanup</button>
</div>

<p data-testid="sent">sent: {sent}</p>
<p data-testid="cleaned">cleaned: {cleaned}</p>
<p data-testid="test-message-exists">testMessageExists: {testMessageExists}</p>
<p data-testid="test-message-body">testMessageBody: {testMessage?.body ?? ''}</p>

{#if messages.isLoading}
	<p data-testid="loading">Loading...</p>
{:else if messages.error}
	<p data-testid="error">{messages.error.message}</p>
{:else}
	<p data-testid="data">Loaded {messages.data.length} messages</p>
{/if}
