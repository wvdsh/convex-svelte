/**
 * Shared module-level ConvexClient singleton.
 *
 * Used by:
 * - `initConvex()` (sveltekit sub-path) to register an early-init client
 * - `setupConvex()` (core) to reuse it instead of creating a new one
 *
 * This avoids a circular dependency between core and sveltekit.
 */
import type { ConvexClient } from 'convex/browser';

let _singletonClient: ConvexClient | null = null;
let _singletonUrl: string | null = null;

export function getSingletonClient(): ConvexClient | null {
	return _singletonClient;
}

export function getSingletonUrl(): string | null {
	return _singletonUrl;
}

export function setSingleton(url: string, client: ConvexClient): void {
	_singletonUrl = url;
	_singletonClient = client;
}
