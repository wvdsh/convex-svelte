import type { PaginationStatus } from 'convex/browser';
import type { FunctionArgs, FunctionReference } from 'convex/server';
import type { Value } from 'convex/values';
import { useConvexClient } from './client.svelte.js';
import { argsKeyEqual, SKIP } from './shared/args.svelte.js';
import { parseArgsWithSkip } from './internal/args.svelte.js';
import type { UsePaginatedQueryOptions, UsePaginatedQueryReturn } from './shared/types.js';

// --- Pagination helpers & types ---------------------------------------------

type WithoutPaginationOpts<Args> = Args extends { paginationOpts: any }
	? Omit<Args, 'paginationOpts'> & { paginationOpts?: never }
	: Args & { paginationOpts?: never };

type PageItem<Query extends FunctionReference<'query'>> = Query['_returnType'] extends {
	page: (infer Item)[];
}
	? Item
	: never;

export type SveltePaginatedQueryOptions<Query extends FunctionReference<'query'>> =
	UsePaginatedQueryOptions & {
		/**
		 * Optional initial data for hydration/SSR.
		 * This must be the full paginated return shape:
		 *   { page: Item[]; isDone: boolean; continueCursor: string }
		 */
		initialData?: Query['_returnType'];
		/**
		 * Instead of clearing results when args change, keep previous page
		 * while loading the new one.
		 */
		keepPreviousData?: boolean;
	};

export type SveltePaginatedQueryReturn<Query extends FunctionReference<'query'>> =
	UsePaginatedQueryReturn<Query> & {
		error: Error | undefined;
	};

export function usePaginatedQuery<Query extends FunctionReference<'query'>>(
	query: Query,
	args:
		| WithoutPaginationOpts<FunctionArgs<Query>>
		| 'skip'
		| (() => WithoutPaginationOpts<FunctionArgs<Query>> | 'skip') = {} as WithoutPaginationOpts<
		FunctionArgs<Query>
	>,
	options: SveltePaginatedQueryOptions<Query> | (() => SveltePaginatedQueryOptions<Query>)
): SveltePaginatedQueryReturn<Query> {
	const client = useConvexClient();
	if (typeof query === 'string') {
		throw new Error('Query must be a functionReference object, not a string');
	}

	// Seed from options (like useQuery)
	const initialOpts = parsePaginatedOptions<Query>(options);
	const hasInitialData = initialOpts.initialData !== undefined;

	const initialResults = hasInitialData
		? (initialOpts.initialData?.page as PageItem<Query>[])
		: ([] as PageItem<Query>[]);
	const initialStatus: PaginationStatus = hasInitialData
		? initialOpts.initialData?.isDone
			? 'Exhausted'
			: 'CanLoadMore'
		: 'LoadingFirstPage';
	const initialIsLoading = !hasInitialData;

	const initialArgs = parseArgsWithSkip(
		args as Record<string, Value> | 'skip' | (() => Record<string, Value> | 'skip')
	);

	const state = $state<{
		results: PageItem<Query>[];
		status: PaginationStatus;
		isLoading: boolean;
		error: Error | undefined;
		loadMore: (numItems: number) => boolean;
		resetKey: number;
		haveArgsEverChanged: boolean;
	}>({
		results: initialResults,
		status: initialStatus,
		isLoading: initialIsLoading,
		error: undefined,
		loadMore: () => false,
		resetKey: 0,
		haveArgsEverChanged: false
	});

	function computeIsLoading(status: PaginationStatus): boolean {
		// While we’re still on initial args + have initialData, keep isLoading=false
		if (hasInitialData && !state.haveArgsEverChanged) {
			return false;
		}
		return status === 'LoadingFirstPage' || status === 'LoadingMore';
	}

	$effect(() => {
		const _resetKey = state.resetKey;

		const argsObject = parseArgsWithSkip(
			args as Record<string, Value> | 'skip' | (() => Record<string, Value> | 'skip')
		);
		const opts = parsePaginatedOptions<Query>(options);
		const keepPrevious = !!opts.keepPreviousData;

		// Track when args change away from the initial key
		if (!state.haveArgsEverChanged && !argsKeyEqual(initialArgs, argsObject)) {
			state.haveArgsEverChanged = true;
		}

		if (client.disabled) {
			state.isLoading = !hasInitialData;
			state.error = undefined;
			state.loadMore = () => false;
			return;
		}

		const isSkipped = argsObject === SKIP;

		if (isSkipped) {
			state.results = [] as PageItem<Query>[];
			state.status = 'LoadingFirstPage';
			state.isLoading = false;
			state.error = undefined;
			state.loadMore = () => false;
			return;
		}

		const usingInitialData = hasInitialData && !state.haveArgsEverChanged;

		const unsubscribe = client.onPaginatedUpdate_experimental(
			query,
			argsObject,
			{ initialNumItems: opts.initialNumItems },
			() => {
				const current = unsubscribe.getCurrentValue?.();
				if (!current) return;

				// 🔑 While hydrating from initialData, ignore the first
				// "empty loading" snapshot: keep SSR page visible.
				if (
					usingInitialData &&
					Array.isArray(current.results) &&
					current.results.length === 0 &&
					current.status === 'LoadingFirstPage'
				) {
					state.loadMore = (numItems: number) => current.loadMore(numItems);
					state.isLoading = false;
					return;
				}

				state.results = current.results as PageItem<Query>[];
				state.status = current.status;
				state.isLoading = computeIsLoading(current.status);
				state.error = undefined;
				state.loadMore = (numItems: number) => current.loadMore(numItems);
			},
			(error: Error) => {
				if (error.message.includes('InvalidCursor')) {
					console.warn('usePaginatedQuery hit InvalidCursor, resetting pagination state:', error);
					state.results = [] as PageItem<Query>[];
					state.status = 'LoadingFirstPage';
					state.isLoading = true;
					state.error = undefined;
					state.resetKey = _resetKey + 1;
					return;
				}

				state.error = error;
				state.isLoading = false;
			}
		);

		const current = unsubscribe.getCurrentValue?.();

		if (current) {
			// Same hydration guard for the initial cached snapshot
			if (
				usingInitialData &&
				Array.isArray(current.results) &&
				current.results.length === 0 &&
				current.status === 'LoadingFirstPage'
			) {
				state.loadMore = (numItems: number) => current.loadMore(numItems);
				state.isLoading = false;
			} else {
				state.results = current.results as PageItem<Query>[];
				state.status = current.status;
				state.isLoading = computeIsLoading(current.status);
				state.error = undefined;
				state.loadMore = (numItems: number) => current.loadMore(numItems);
			}
		} else {
			// No cached value yet
			const shouldKeepPrevious = keepPrevious && state.results.length > 0;

			if (!usingInitialData && !shouldKeepPrevious) {
				state.results = [] as PageItem<Query>[];
				state.status = 'LoadingFirstPage';
			}
			state.isLoading = usingInitialData ? false : true;
			state.error = undefined;

			state.loadMore = (numItems: number) => {
				const latest = unsubscribe.getCurrentValue?.();
				if (!latest) return false;
				return latest.loadMore(numItems);
			};
		}

		return () => {
			if (typeof unsubscribe === 'function') {
				unsubscribe();
			} else if ('unsubscribe' in (unsubscribe as any)) {
				(unsubscribe as any).unsubscribe();
			}
		};
	});

	return {
		get results() {
			return state.results;
		},
		get status() {
			return state.status;
		},
		get isLoading() {
			return state.isLoading;
		},
		get error() {
			return state.error;
		},
		loadMore(numItems: number) {
			return state.loadMore(numItems);
		}
	} as SveltePaginatedQueryReturn<Query>;
}

function parsePaginatedOptions<Query extends FunctionReference<'query'>>(
	options: SveltePaginatedQueryOptions<Query> | (() => SveltePaginatedQueryOptions<Query>)
): SveltePaginatedQueryOptions<Query> {
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