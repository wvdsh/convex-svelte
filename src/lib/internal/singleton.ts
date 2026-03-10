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

// ---------------------------------------------------------------------------
// Deferred subscription queue for transport.decode → setupAuth coordination.
//
// Problem: SvelteKit's transport.decode (which calls createDetachedQuery)
// runs BEFORE component initialization (where setupAuth calls client.setAuth).
// If subscriptions fire immediately, they hit the server without auth,
// causing Unauthenticated errors and overwriting SSR data for soft-auth queries.
//
// Solution: transport.decode queues subscriptions via deferSubscription().
// setupAuth (or setupConvex for no-auth apps) calls flushDeferredSubscriptions()
// after client.setAuth() to fire them with auth ready.
// ---------------------------------------------------------------------------
let _deferredSubscriptions: Array<() => void> | null = [];

/**
 * Queue a subscription to fire after auth is ready.
 * If already flushed (auth ready), fires immediately.
 */
export function deferSubscription(fn: () => void): void {
	if (_deferredSubscriptions === null) {
		// Already flushed — auth is ready, fire immediately
		fn();
	} else {
		_deferredSubscriptions.push(fn);
	}
}

/**
 * Flush all deferred subscriptions and switch to immediate mode.
 * Called by setupAuth() after client.setAuth(), or by setupConvex()
 * as a fallback for no-auth apps.
 *
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function flushDeferredSubscriptions(): void {
	if (_deferredSubscriptions === null) return;
	const pending = _deferredSubscriptions;
	_deferredSubscriptions = null; // Switch to immediate mode
	for (const fn of pending) fn();
}

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

/**
 * Get the module-level ConvexClient singleton.
 * Works anywhere (hooks, transport, utilities) — does not require Svelte context.
 *
 * @throws If `initConvex()` or `setupConvex()` has not been called yet.
 */
export function getConvexClient(): ConvexClient {
	if (!_singletonClient) {
		throw new Error('Convex client not initialized. Call setupConvex() or initConvex() first.');
	}
	return _singletonClient;
}

/**
 * Get the stored Convex deployment URL.
 *
 * @throws If `initConvex()` or `setupConvex()` has not been called yet.
 */
export function getConvexUrl(): string {
	if (!_singletonUrl) {
		throw new Error('Convex URL not set. Call setupConvex() or initConvex() first.');
	}
	return _singletonUrl;
}
