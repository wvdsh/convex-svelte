/**
 * SSR bridge — convexLoad() + transport encode/decode.
 *
 * On the server, convexLoad fetches via ConvexHttpClient (auth-aware if token provided).
 * On the client, transport.decode upgrades it to a live subscription.
 * On client-side navigation, convexLoad creates a live subscription directly.
 */
import type { FunctionReference, FunctionArgs } from 'convex/server';
import { getFunctionName, makeFunctionReference } from 'convex/server';
import { ConvexHttpClient } from 'convex/browser';
import { getConvexUrl } from '../internal/singleton.js';
import { createDetachedQuery, type DetachedQueryResult } from './query-detached.svelte.js';

const IS_BROWSER = typeof globalThis.document !== 'undefined';

/**
 * Marker class for transport.encode to recognize.
 * Wraps the server-fetched data along with the query reference and args
 * so transport.decode can upgrade it to a live subscription.
 */
export class ConvexLoadResult<T = unknown> {
	readonly __convexLoad = true;

	/** Always `false` — data was already fetched on the server. */
	readonly isLoading = false;

	/** Always `undefined` — the server fetch succeeded. */
	readonly error: undefined = undefined;

	/** Always `false` — fresh from the server. */
	readonly isStale = false;

	constructor(
		public readonly refName: string,
		public readonly args: Record<string, unknown>,
		public readonly data: T
	) {}
}

/**
 * Fetch Convex data for use in SvelteKit load functions.
 *
 * - **Server (SSR):** fetches via `ConvexHttpClient`, returns `ConvexLoadResult`.
 *   The SvelteKit transport hook decodes it into a live subscription on the client.
 * - **Client (navigation):** creates a live subscription directly via
 *   `createDetachedQuery()` with HTTP-fetched initial data.
 *
 * @example
 * ```ts
 * // +page.ts (universal load function)
 * import { convexLoad } from 'convex-svelte/sveltekit';
 * import { api } from '$convex/_generated/api';
 *
 * export const load = async () => ({
 *   tasks: await convexLoad(api.tasks.get, {})
 * });
 * ```
 *
 * @param ref - A query FunctionReference like `api.tasks.get`.
 * @param args - Arguments for the query.
 * @param options - Optional `{ token }` for authenticated server-side fetches.
 */
export async function convexLoad<Query extends FunctionReference<'query'>>(
	ref: Query,
	args: FunctionArgs<Query>,
	options?: { token?: string }
): Promise<DetachedQueryResult<Query>> {
	const httpClient = new ConvexHttpClient(getConvexUrl());

	if (!IS_BROWSER && options?.token) {
		httpClient.setAuth(options.token);
	}

	if (IS_BROWSER) {
		// Client-side navigation: fetch initial data, then create live subscription
		const initialData = await httpClient.query(ref, args);
		return createDetachedQuery(ref, args, initialData) as DetachedQueryResult<Query>;
	}

	// Server-side: HTTP fetch, wrap in ConvexLoadResult for transport.
	// transport.decode replaces this with a DetachedQueryResult on the client.
	const data = await httpClient.query(ref, args);
	const name = getFunctionName(ref);
	return new ConvexLoadResult(
		name,
		args as Record<string, unknown>,
		data
	) as unknown as DetachedQueryResult<Query>;
}

/**
 * Encode a `ConvexLoadResult` for serialization across the SSR boundary.
 * Use in SvelteKit's `transport` hook (`hooks.ts`).
 *
 * @example
 * ```ts
 * // hooks.ts
 * import { encodeConvexLoad, decodeConvexLoad } from 'convex-svelte/sveltekit';
 *
 * export const transport = {
 *   ConvexLoadResult: {
 *     encode: encodeConvexLoad,
 *     decode: decodeConvexLoad
 *   }
 * };
 * ```
 */
export function encodeConvexLoad(
	value: unknown
): false | { refName: string; args: Record<string, unknown>; data: unknown } {
	if (
		value instanceof ConvexLoadResult ||
		(value != null && typeof value === 'object' && '__convexLoad' in value)
	) {
		const v = value as ConvexLoadResult;
		return { refName: v.refName, args: v.args, data: v.data };
	}
	return false;
}

/**
 * Decode a serialized `ConvexLoadResult` into a live query subscription.
 * Uses `createDetachedQuery` — works outside component context (transport.decode).
 */
export function decodeConvexLoad(encoded: {
	refName: string;
	args: Record<string, unknown>;
	data: unknown;
}): DetachedQueryResult<FunctionReference<'query'>> {
	const ref = makeFunctionReference<'query'>(encoded.refName);
	return createDetachedQuery(ref, encoded.args, encoded.data);
}
