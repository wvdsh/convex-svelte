// SvelteKit-specific Convex integration
// Import from 'convex-svelte/sveltekit'

// Client lifecycle (module singleton)
export { initConvex, getConvexClient, getConvexUrl } from './client.js';

// Server-side HTTP client
export { createConvexHttpClient, type CreateConvexHttpClientOptions } from './server.js';

// Detached query (non-component subscriptions)
export { createDetachedQuery, type DetachedQueryResult } from './query-detached.svelte.js';

// SSR transport bridge
export {
	convexLoad,
	ConvexLoadResult,
	encodeConvexLoad,
	decodeConvexLoad
} from './transport.svelte.js';
