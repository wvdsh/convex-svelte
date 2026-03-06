<script lang="ts">
	import { useAuth } from '$lib/index.js';

	const auth = useAuth();
</script>

<section>
	<h1>Auth Test</h1>

	<div data-testid="auth-state">
		{#if auth.isLoading}
			<p data-testid="auth-loading">Auth Loading</p>
		{:else if auth.isAuthenticated}
			<p data-testid="auth-authenticated">Authenticated</p>
		{:else}
			<p data-testid="auth-unauthenticated">Unauthenticated</p>
		{/if}
	</div>

	<div data-testid="auth-values">
		<p data-testid="is-loading">isLoading: {auth.isLoading}</p>
		<p data-testid="is-authenticated">isAuthenticated: {auth.isAuthenticated}</p>
	</div>
</section>
