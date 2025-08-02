import { getContext, setContext, untrack } from 'svelte';
import { ConvexClient, type ConvexClientOptions } from 'convex/browser';
import {
	type FunctionReference,
	type FunctionArgs,
	type FunctionReturnType,
	getFunctionName,
	type PaginationOptions,
	type PaginationResult,
	type BetterOmit
} from 'convex/server';
import { convexToJson, type Value } from 'convex/values';
import { BROWSER } from 'esm-env';
import { isEqual } from 'lodash-es';

const _contextKey = '$$_convexClient';

export const useConvexClient = (): ConvexClient => {
	const client = getContext(_contextKey) as ConvexClient | undefined;
	if (!client) {
		throw new Error(
			'No ConvexClient was found in Svelte context. Did you forget to call setupConvex() in a parent component?'
		);
	}
	return client;
};

export const setConvexClientContext = (client: ConvexClient): void => {
	setContext(_contextKey, client);
};

export const setupConvex = (url: string, options: ConvexClientOptions = {}) => {
	if (!url || typeof url !== 'string') {
		throw new Error('Expected string url property for setupConvex');
	}
	const optionsWithDefaults = { disabled: !BROWSER, ...options };

	const client = new ConvexClient(url, optionsWithDefaults);
	setConvexClientContext(client);
	$effect(() => () => client.close());
};

type UseQueryOptions<Query extends FunctionReference<'query'>> = {
	// Use this data and assume it is up to date (typically for SSR and hydration)
	initialData?: FunctionReturnType<Query>;
	// Instead of loading, render result from outdated args
	keepPreviousData?: boolean;
	// Whether the query should be enabled (defaults to true)
	enabled?: boolean | (() => boolean);
};

type UseQueryReturn<Query extends FunctionReference<'query'>> =
	| { data: undefined; error: undefined; isLoading: true; isStale: false }
	| { data: undefined; error: Error; isLoading: false; isStale: boolean }
	| { data: FunctionReturnType<Query>; error: undefined; isLoading: false; isStale: boolean };

// Note that swapping out the current Convex client is not supported.
/**
 * Subscribe to a Convex query and return a reactive query result object.
 * Pass reactive args object or a closure returning args to update args reactively.
 *
 * @param query - a FunctionRefernece like `api.dir1.dir2.filename.func`.
 * @param args - The arguments to the query function.
 * @param options - UseQueryOptions like `initialData`, `keepPreviousData`, and `enabled` (can be boolean or function).
 * @returns an object containing data, isLoading, error, and isStale.
 */
export function useQuery<Query extends FunctionReference<'query'>>(
	query: Query,
	args: FunctionArgs<Query> | (() => FunctionArgs<Query>),
	options: UseQueryOptions<Query> | (() => UseQueryOptions<Query>) = {},
): UseQueryReturn<Query> {
	const client = useConvexClient();
	if (typeof query === 'string') {
		throw new Error('Query must be a functionReference object, not a string');
	}
	const state: {
		result: FunctionReturnType<Query> | Error | undefined;
		// The last result we actually received, if this query has ever received one.
		lastResult: FunctionReturnType<Query> | Error | undefined;
		// The args (query key) of the last result that was received.
		argsForLastResult: FunctionArgs<Query>;
		// If the args have never changed, fine to use initialData if provided.
		haveArgsEverChanged: boolean;
	} = $state({
		result: parseOptions(options).initialData,
		argsForLastResult: undefined,
		lastResult: undefined,
		haveArgsEverChanged: false
	});

	// When args change we need to unsubscribe to the old query and subscribe
	// to the new one.
	$effect(() => {
		const argsObject = parseArgs(args);
		const opts = parseOptions(options);
		
		// Only subscribe if enabled (defaults to true)
		if (opts.enabled) {
			const unsubscribe = client.onUpdate(
				query,
				argsObject,
				(dataFromServer) => {
					const copy = structuredClone(dataFromServer);

					state.result = copy;
					state.argsForLastResult = argsObject;
					state.lastResult = copy;
				},
				(e: Error) => {
					state.result = e;
					state.argsForLastResult = argsObject;
					// is it important to copy the error here?
					const copy = structuredClone(e);
					state.lastResult = copy;
				}
			);
			return unsubscribe;
		}
		
		// Return no-op cleanup when disabled
		return () => {};
	});

	// Are the args (the query key) the same as the last args we received a result for?
	const sameArgsAsLastResult = $derived(
		!!state.argsForLastResult &&
			JSON.stringify(convexToJson(state.argsForLastResult)) ===
				JSON.stringify(convexToJson(parseArgs(args)))
	);
	const staleAllowed = $derived(!!(parseOptions(options).keepPreviousData && state.lastResult));

	// Not reactive
	const initialArgs = parseArgs(args);
	// Once args change, move off of initialData.
	$effect(() => {
		if (!untrack(() => state.haveArgsEverChanged)) {
			if (
				JSON.stringify(convexToJson(parseArgs(args))) !== JSON.stringify(convexToJson(initialArgs))
			) {
				state.haveArgsEverChanged = true;
				const opts = parseOptions(options);
				if (opts.initialData !== undefined) {
					state.argsForLastResult = $state.snapshot(initialArgs);
					state.lastResult = parseOptions(options).initialData;
				}
			}
		}
	});

	// Return value or undefined; never an error object.
	const syncResult: FunctionReturnType<Query> | undefined = $derived.by(() => {
		const opts = parseOptions(options);
		if (opts.initialData && !state.haveArgsEverChanged) {
			return state.result;
		}
		let value;
		try {
			value = client.disabled
				? undefined
				: client.client.localQueryResult(getFunctionName(query), parseArgs(args));
		} catch (e) {
			if (!(e instanceof Error)) {
				// This should not happen by the API of localQueryResult().
				console.error('threw non-Error instance', e);
				throw e;
			}
			value = e;
		}
		// If state result has updated then it's time to check the for a new local value
		state.result;
		return value;
	});

	const result = $derived.by(() => {
		return syncResult !== undefined ? syncResult : staleAllowed ? state.lastResult : undefined;
	});
	const isStale = $derived(
		syncResult === undefined && staleAllowed && !sameArgsAsLastResult && result !== undefined
	);
	const data = $derived.by(() => {
		if (result instanceof Error) {
			return undefined;
		}
		return result;
	});
	const error = $derived.by(() => {
		if (result instanceof Error) {
			return result;
		}
		return undefined;
	});

	// This TypeScript cast promises data is not undefined if error and isLoading are checked first.
	return {
		get data() {
			return data;
		},
		get isLoading() {
			const opts = parseOptions(options);
			if (!opts.enabled) return false;
			return error === undefined && data === undefined;
		},
		get error() {
			return error;
		},
		get isStale() {
			return isStale;
		}
	} as UseQueryReturn<Query>;
}

// args can be an object or a closure returning one
function parseArgs(
	args: Record<string, Value> | (() => Record<string, Value>)
): Record<string, Value> {
	if (typeof args === 'function') {
		args = args();
	}
	return $state.snapshot(args);
}

// options can be an object or a closure
function parseOptions<Query extends FunctionReference<'query'>>(
	options: UseQueryOptions<Query> | (() => UseQueryOptions<Query>)
): Omit<UseQueryOptions<Query>, 'enabled'> & { enabled: boolean } {
	if (typeof options === 'function') {
		options = options();
	}

	// Resolve enabled to boolean and create clean object for snapshot
	const resolvedEnabled = options.enabled !== undefined 
		? (typeof options.enabled === 'function' ? options.enabled() : options.enabled)
		: true;

	// Create a new object with only cloneable properties
	const cleanOptions = {
		initialData: options.initialData,
		keepPreviousData: options.keepPreviousData,
		enabled: resolvedEnabled
	};

	return $state.snapshot(cleanOptions);
}

// Type constraint for paginated queries
type PaginatedQuery = FunctionReference<'query', 'public', { paginationOpts: PaginationOptions }, PaginationResult<any>>;

export type PaginatedQueryItem<Query extends PaginatedQuery> =
  FunctionReturnType<Query>["page"][number];

type UsePaginatedQueryOptions<Query extends PaginatedQuery> = {
	initialNumItems?: number;
	initialData?: PaginationResult<FunctionReturnType<Query>>;
};

export type PaginatedQueryArgs<Query extends PaginatedQuery> = Expand<
  BetterOmit<FunctionArgs<Query>, "paginationOpts">>

enum UsePaginationQueryStatus {
	LoadingFirstPage = 'LoadingFirstPage',
	CanLoadMore = 'CanLoadMore',
	LoadingMore = 'LoadingMore',
	Exhausted = 'Exhausted'
}

type UsePaginatedQueryReturn<Item> = {
	results: Item[] | undefined;
	status: UsePaginationQueryStatus;
	loadMore: (numItems: number) => void;
	error: Error | undefined;
};

/**
 * Subscribe to a paginated Convex query and return reactive paginated results.
 * Automatically handles cursor management and provides a loadMore function.
 *
 * @param query - a FunctionReference that returns PaginationResult.
 * @param args - The arguments to the query function (excluding paginationOpts).
 * @param options - Options like initialNumItems.
 * @returns an object containing results, status, loadMore function, isLoading, and error.
 */
export function usePaginatedQuery<
	Query extends PaginatedQuery
>(
	query: Query,
	args: PaginatedQueryArgs<Query> | (() => PaginatedQueryArgs<Query>),
	options: UsePaginatedQueryOptions<Query> = {}
): UsePaginatedQueryReturn<PaginatedQueryItem<Query>> {

	const { initialNumItems = 10, initialData } = options;
	const client = useConvexClient();

	let nextCursor = $state(initialData ? initialData.continueCursor : null);
	const pages = $state<PaginationResult<PaginatedQueryItem<Query>>[]>(initialData ? [initialData] : []);
	const pagesLoading = $state<Record<string, boolean>>({
		"initial": initialData ? false : true,
	});
	let isDone = $state(initialData && initialData.isDone ? true : false);
	let error = $state<Error | undefined>(undefined);

	// Track all active subscriptions
	const subscriptions = new Map<string, () => void>();

	function subscribeToPage(cursor: string | null, args: Record<string, Value>) {
		const pageKey = cursor ?? 'initial';
		// we already handled the status for the first one
		if (cursor) {
			pagesLoading[pageKey] = true;
		}
		
		const unsubscribe = client.onUpdate(
			query,
			{ ...args, paginationOpts: { numItems: initialNumItems, cursor } },
			(dataFromServer) => {
				pagesLoading[pageKey] = false;
				const pageIndex = pages.findIndex(page => page.continueCursor === dataFromServer.continueCursor);

				if (pageIndex === -1) {
					pages.push(dataFromServer);
				} else {
					// Only update if the data actually changed
					const existingPage = pages[pageIndex];
					if (!isEqual(existingPage, dataFromServer)) {
						pages[pageIndex] = dataFromServer;
					}
				}
				nextCursor = dataFromServer.continueCursor;
				isDone = dataFromServer.isDone;
			},
			(e: Error) => {
				console.log(`error: `, e);
				error = e;
			}
		);

		subscriptions.set(pageKey, unsubscribe);
		return unsubscribe;
	}

	// Track if this is the first render with initial args
	let isFirstRender = true;

	// Watch for args changes and re-subscribe
	$effect(() => {
		// Parse args reactively to trigger effect on changes
		const argsObject = parseArgs(args);

		untrack(() => {
			// Clear existing subscriptions
			subscriptions.forEach(unsubscribe => unsubscribe());
			subscriptions.clear();

			// Reset state
			if (isFirstRender && initialData) {
				// Only use initialData on first render
				nextCursor = initialData.continueCursor;
				pages.length = 0;
				pages.push(initialData);
				Object.keys(pagesLoading).forEach(key => delete pagesLoading[key]);
				pagesLoading["initial"] = false;
				isDone = initialData.isDone;
			} else {
				// For subsequent renders or when args change, ignore initialData
				nextCursor = null;
				pages.length = 0;
				Object.keys(pagesLoading).forEach(key => delete pagesLoading[key]);
				pagesLoading["initial"] = true;
				isDone = false;
			}
			error = undefined;
			isFirstRender = false;

			// Subscribe to initial page with new args
			subscribeToPage(null, argsObject);
		})
		
		// Cleanup on unmount
		return () => {
			subscriptions.forEach(unsubscribe => unsubscribe());
			subscriptions.clear();
		};
	});

	// Load more function
	const loadMore = () => {
		subscribeToPage(nextCursor, parseArgs(args));
	};

	// Determine status
	const status = $derived.by(() => {
		if (pagesLoading["initial"]) {
			return UsePaginationQueryStatus.LoadingFirstPage;
		}

		const atLeastOnePageLoaded = Object.values(pagesLoading).some(loading => loading);
		if (atLeastOnePageLoaded) {
			return UsePaginationQueryStatus.LoadingMore;
		}

		if (isDone) {
			return UsePaginationQueryStatus.Exhausted;
		}

		return UsePaginationQueryStatus.CanLoadMore;

	});

	// Derive results before the return statement
	const results = $derived(pages.flatMap(page => page.page));

	return {
		get results() {
			return results;
		},
		loadMore,
		get status() {
			return status;
		},
		get error() {
			return error;
		},
	};
}
