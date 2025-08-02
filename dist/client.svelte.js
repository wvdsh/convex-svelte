import { getContext, setContext, untrack } from 'svelte';
import { ConvexClient } from 'convex/browser';
import { getFunctionName } from 'convex/server';
import { convexToJson } from 'convex/values';
import { BROWSER } from 'esm-env';
import { isEqual } from 'lodash-es';
const _contextKey = '$$_convexClient';
export const useConvexClient = () => {
    const client = getContext(_contextKey);
    if (!client) {
        throw new Error('No ConvexClient was found in Svelte context. Did you forget to call setupConvex() in a parent component?');
    }
    return client;
};
export const setConvexClientContext = (client) => {
    setContext(_contextKey, client);
};
export const setupConvex = (url, options = {}) => {
    if (!url || typeof url !== 'string') {
        throw new Error('Expected string url property for setupConvex');
    }
    const optionsWithDefaults = { disabled: !BROWSER, ...options };
    const client = new ConvexClient(url, optionsWithDefaults);
    setConvexClientContext(client);
    $effect(() => () => client.close());
};
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
export function useQuery(query, args, options = {}) {
    const client = useConvexClient();
    if (typeof query === 'string') {
        throw new Error('Query must be a functionReference object, not a string');
    }
    const state = $state({
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
            const unsubscribe = client.onUpdate(query, argsObject, (dataFromServer) => {
                const copy = structuredClone(dataFromServer);
                state.result = copy;
                state.argsForLastResult = argsObject;
                state.lastResult = copy;
            }, (e) => {
                state.result = e;
                state.argsForLastResult = argsObject;
                // is it important to copy the error here?
                const copy = structuredClone(e);
                state.lastResult = copy;
            });
            return unsubscribe;
        }
        // Return no-op cleanup when disabled
        return () => { };
    });
    // Are the args (the query key) the same as the last args we received a result for?
    const sameArgsAsLastResult = $derived(!!state.argsForLastResult &&
        JSON.stringify(convexToJson(state.argsForLastResult)) ===
            JSON.stringify(convexToJson(parseArgs(args))));
    const staleAllowed = $derived(!!(parseOptions(options).keepPreviousData && state.lastResult));
    // Not reactive
    const initialArgs = parseArgs(args);
    // Once args change, move off of initialData.
    $effect(() => {
        if (!untrack(() => state.haveArgsEverChanged)) {
            if (JSON.stringify(convexToJson(parseArgs(args))) !== JSON.stringify(convexToJson(initialArgs))) {
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
    const syncResult = $derived.by(() => {
        const opts = parseOptions(options);
        if (opts.initialData && !state.haveArgsEverChanged) {
            return state.result;
        }
        let value;
        try {
            value = client.disabled
                ? undefined
                : client.client.localQueryResult(getFunctionName(query), parseArgs(args));
        }
        catch (e) {
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
    const isStale = $derived(syncResult === undefined && staleAllowed && !sameArgsAsLastResult && result !== undefined);
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
            if (!opts.enabled)
                return false;
            return error === undefined && data === undefined;
        },
        get error() {
            return error;
        },
        get isStale() {
            return isStale;
        }
    };
}
// args can be an object or a closure returning one
function parseArgs(args) {
    if (typeof args === 'function') {
        args = args();
    }
    return $state.snapshot(args);
}
// options can be an object or a closure
function parseOptions(options) {
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
var UsePaginationQueryStatus;
(function (UsePaginationQueryStatus) {
    UsePaginationQueryStatus["LoadingFirstPage"] = "LoadingFirstPage";
    UsePaginationQueryStatus["CanLoadMore"] = "CanLoadMore";
    UsePaginationQueryStatus["LoadingMore"] = "LoadingMore";
    UsePaginationQueryStatus["Exhausted"] = "Exhausted";
})(UsePaginationQueryStatus || (UsePaginationQueryStatus = {}));
/**
 * Subscribe to a paginated Convex query and return reactive paginated results.
 * Automatically handles cursor management and provides a loadMore function.
 *
 * @param query - a FunctionReference that returns PaginationResult.
 * @param args - The arguments to the query function (excluding paginationOpts).
 * @param options - Options like initialNumItems.
 * @returns an object containing results, status, loadMore function, isLoading, and error.
 */
export function usePaginatedQuery(query, args, options = {}) {
    const { initialNumItems = 10, initialData } = options;
    const client = useConvexClient();
    let nextCursor = $state(initialData ? initialData.continueCursor : null);
    const pages = $state(initialData ? [initialData] : []);
    const pagesLoading = $state({
        "initial": initialData ? false : true,
    });
    let isDone = $state(initialData && initialData.isDone ? true : false);
    let error = $state(undefined);
    // Track all active subscriptions
    const subscriptions = new Map();
    function subscribeToPage(cursor, args) {
        const pageKey = cursor ?? 'initial';
        // we already handled the status for the first one
        if (cursor) {
            pagesLoading[pageKey] = true;
        }
        const unsubscribe = client.onUpdate(query, { ...args, paginationOpts: { numItems: initialNumItems, cursor } }, (dataFromServer) => {
            pagesLoading[pageKey] = false;
            const pageIndex = pages.findIndex(page => page.continueCursor === dataFromServer.continueCursor);
            if (pageIndex === -1) {
                pages.push(dataFromServer);
            }
            else {
                // Only update if the data actually changed
                const existingPage = pages[pageIndex];
                if (!isEqual(existingPage, dataFromServer)) {
                    pages[pageIndex] = dataFromServer;
                }
            }
            nextCursor = dataFromServer.continueCursor;
            isDone = dataFromServer.isDone;
        }, (e) => {
            console.log(`error: `, e);
            error = e;
        });
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
            }
            else {
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
        });
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
