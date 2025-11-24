// src/lib/use_paginated_query.svelte.ts (or wherever you keep it)
import type { PaginationStatus } from 'convex/browser';
import type { FunctionArgs, FunctionReference } from 'convex/server';
import type { Value } from 'convex/values';
import { useConvexClient } from './client.svelte.js';
import { parseArgs, SKIP } from './internal/args.svelte.js';

// --- Pagination helpers & types ---------------------------------------------

type WithoutPaginationOpts<Args> = Args extends { paginationOpts: any }
	? Omit<Args, 'paginationOpts'> & { paginationOpts?: never }
	: Args & { paginationOpts?: never };

type PageItem<Query extends FunctionReference<'query'>> = Query['_returnType'] extends {
	page: (infer Item)[];
}
	? Item
	: never;

export type UsePaginatedQueryOptions<Query extends FunctionReference<'query'>> = {
	/**
	 * How many items to load in the first page.
	 */
	initialNumItems: number;
	/**
	 * Optional initial data for hydration/SSR.
	 * This must be the full paginated return shape:
	 *   { page: Item[]; isDone: boolean; continueCursor: string }
	 */
	initialData?: Query['_returnType'];
};

export type UsePaginatedQueryReturn<Query extends FunctionReference<'query'>> = {
	results: PageItem<Query>[];
	status: PaginationStatus;
	isLoading: boolean;
	error: Error | undefined;
	loadMore: (numItems: number) => boolean;
};

/**
 * Load data reactively from a paginated query to create a growing list.
 *
 * Mirrors the React `usePaginatedQuery` API:
 *   const messages = usePaginatedQuery(api.messages.list, { channel: '#general' }, { initialNumItems: 5 });
 *
 * - `query` must be a paginated Convex query (returns `{ page, isDone, continueCursor }`).
 * - `args` is the query args **without** `paginationOpts`. Pagination is handled internally.
 * - `options.initialNumItems` controls the first page size.
 * - `options.initialData` seeds the initial page + status (useful for SSR/hydration).
 *
 * Supports `"skip"` just like `useQuery`:
 *   usePaginatedQuery(api.list, () => (authed ? { ... } : 'skip'), { initialNumItems: 10 })
 */
export function usePaginatedQuery<Query extends FunctionReference<'query'>>(
	query: Query,
	args:
		| WithoutPaginationOpts<FunctionArgs<Query>>
		| 'skip'
		| (() => WithoutPaginationOpts<FunctionArgs<Query>> | 'skip') = {} as WithoutPaginationOpts<
		FunctionArgs<Query>
	>,
	options: UsePaginatedQueryOptions<Query> | (() => UsePaginatedQueryOptions<Query>)
): UsePaginatedQueryReturn<Query> {
	const client = useConvexClient();
	if (typeof query === 'string') {
		throw new Error('Query must be a functionReference object, not a string');
	}

	// Use options once to seed initial state (like useQuery does with initialData)
	const initialOpts = parsePaginatedOptions<Query>(options);
	const initialResults = initialOpts.initialData
		? ((initialOpts.initialData as any).page as PageItem<Query>[])
		: ([] as PageItem<Query>[]);
	const initialStatus: PaginationStatus = initialOpts.initialData
		? (initialOpts.initialData as any).isDone
			? 'Exhausted'
			: 'CanLoadMore'
		: 'LoadingFirstPage';
	const initialIsLoading = !initialOpts.initialData;

	const state = $state<{
		results: PageItem<Query>[];
		status: PaginationStatus;
		isLoading: boolean;
		error: Error | undefined;
		loadMore: (numItems: number) => boolean;
		// used to trigger a reset when we hit InvalidCursor
		resetKey: number;
	}>({
		results: initialResults,
		status: initialStatus,
		isLoading: initialIsLoading,
		error: undefined,
		loadMore: () => false,
		resetKey: 0
	});

	$effect(() => {
		// make resetKey a dependency of this effect so we can force-reset pagination
		const _resetKey = state.resetKey;

		const argsObject = parseArgs(
			args as Record<string, Value> | 'skip' | (() => Record<string, Value> | 'skip')
		);
		const opts = parsePaginatedOptions<Query>(options);

		// SSR / disabled client: behave like "loading"
		if (client.disabled) {
			state.results = [] as PageItem<Query>[];
			state.status = 'LoadingFirstPage';
			state.isLoading = true;
			state.error = undefined;
			state.loadMore = () => false;
			return;
		}

		const isSkipped = argsObject === SKIP;

		if (isSkipped) {
			// Like useQuery: skip => not loading, no error, empty results
			state.results = [] as PageItem<Query>[];
			state.status = 'LoadingFirstPage';
			state.isLoading = false;
			state.error = undefined;
			state.loadMore = () => false;
			return;
		}

		// Subscribe to the paginated query.
		const unsubscribe = client.onPaginatedUpdate_experimental(
			query,
			argsObject as any,
			{ initialNumItems: opts.initialNumItems },
			() => {
				// Each time a page updates, read the aggregated result.
				const current = (unsubscribe as any).getCurrentValue?.();
				if (!current) return;

				state.results = current.results as PageItem<Query>[];
				state.status = current.status;
				state.isLoading = current.status === 'LoadingFirstPage' || current.status === 'LoadingMore';
				// once we have a valid result, clear any previous error
				state.error = undefined;
				state.loadMore = (numItems: number) => current.loadMore(numItems);
			},
			(error: Error) => {
				// Pagination-specific errors: reset; others: surface as .error
				if (error.message.includes('InvalidCursor')) {
					console.warn('usePaginatedQuery hit InvalidCursor, resetting pagination state:', error);
					state.results = [] as PageItem<Query>[];
					state.status = 'LoadingFirstPage';
					state.isLoading = true;
					state.error = undefined;
					state.resetKey = _resetKey + 1;
					return;
				}

				// For non-pagination errors, keep last good results but expose .error
				state.error = error;
				state.isLoading = false;
			}
		);

		// Initialize from any already-cached value from the paginated client.
		const initial = (unsubscribe as any).getCurrentValue?.();
		if (initial) {
			state.results = initial.results as PageItem<Query>[];
			state.status = initial.status;
			state.isLoading = initial.status === 'LoadingFirstPage' || initial.status === 'LoadingMore';
			state.error = undefined;
			state.loadMore = (numItems: number) => initial.loadMore(numItems);
		} else if (!initialOpts.initialData) {
			// Only override the seeded initialData state if we *didn't* have initialData
			state.results = [] as PageItem<Query>[];
			state.status = 'LoadingFirstPage';
			state.isLoading = true;
			state.error = undefined;
			state.loadMore = (numItems: number) => {
				const current = (unsubscribe as any).getCurrentValue?.();
				if (!current) return false;
				return current.loadMore(numItems);
			};
		}

		// Cleanup on args / options change or component unmount.
		return () => {
			if (typeof unsubscribe === 'function') {
				(unsubscribe as any)();
			} else if ('unsubscribe' in (unsubscribe as any)) {
				(unsubscribe as any).unsubscribe();
			}
		};
	});

	const results = $derived(state.results);
	const status = $derived(state.status);
	const isLoading = $derived(state.isLoading);
	const error = $derived(state.error);

	return {
		get results() {
			return results;
		},
		get status() {
			return status;
		},
		get isLoading() {
			return isLoading;
		},
		get error() {
			return error;
		},
		loadMore(numItems: number) {
			return state.loadMore(numItems);
		}
	} as UsePaginatedQueryReturn<Query>;
}

// --- helpers ---------------------------------------------------------------

function parsePaginatedOptions<Query extends FunctionReference<'query'>>(
	options: UsePaginatedQueryOptions<Query> | (() => UsePaginatedQueryOptions<Query>)
): UsePaginatedQueryOptions<Query> {
	if (typeof options === 'function') {
		options = options();
	}
	const snapshot = $state.snapshot(options);
	if (typeof snapshot.initialNumItems !== 'number' || snapshot.initialNumItems < 0) {
		throw new Error(
			`\`options.initialNumItems\` must be a positive number. Received \`${snapshot.initialNumItems}\`.`
		);
	}
	return snapshot;
}
