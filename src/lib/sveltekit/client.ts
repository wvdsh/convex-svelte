/**
 * ConvexClient lifecycle — module singleton for SvelteKit.
 *
 * Two init points (both idempotent, share the same instance):
 * - `initConvex(url)` in hooks.client.ts — early init so transport.decode can subscribe
 * - `setupConvex(url)` in root layout — handles context + cleanup, calls initConvex internally
 */
import { ConvexClient, type ConvexClientOptions } from 'convex/browser';
import { getSingletonClient, getSingletonUrl, setSingleton } from '../internal/singleton.js';

const IS_BROWSER = typeof globalThis.document !== 'undefined';

/**
 * Initialize the Convex client at module level (before any component mounts).
 * Call from `hooks.client.ts` to ensure the client exists before `transport.decode`.
 * Idempotent — subsequent calls with the same URL are no-ops.
 *
 * @param url - Your Convex deployment URL (e.g. `PUBLIC_CONVEX_URL`).
 * @param options - Optional `ConvexClientOptions`.
 * @returns The singleton `ConvexClient` instance.
 */
export function initConvex(url: string, options: ConvexClientOptions = {}): ConvexClient {
	const existing = getSingletonClient();
	if (existing) return existing;
	if (!url || typeof url !== 'string') {
		throw new Error('initConvex requires a non-empty URL string');
	}
	const client = new ConvexClient(url, { disabled: !IS_BROWSER, ...options });
	setSingleton(url, client);
	return client;
}

/**
 * Get the module-level ConvexClient singleton.
 * Works anywhere (hooks, transport, utilities) — does not require Svelte context.
 *
 * @throws If `initConvex()` has not been called yet.
 */
export function getConvexClient(): ConvexClient {
	const client = getSingletonClient();
	if (!client) {
		throw new Error(
			'Convex client not initialized. Call initConvex() first (e.g. in hooks.client.ts).'
		);
	}
	return client;
}

/**
 * Get the stored Convex deployment URL.
 *
 * @throws If `initConvex()` has not been called yet.
 */
export function getConvexUrl(): string {
	const url = getSingletonUrl();
	if (!url) {
		throw new Error('Convex URL not set. Call initConvex() first.');
	}
	return url;
}
