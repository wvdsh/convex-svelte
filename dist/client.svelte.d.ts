import { ConvexClient, type ConvexClientOptions } from 'convex/browser';
import { type FunctionReference, type FunctionArgs, type FunctionReturnType, type PaginationOptions, type PaginationResult, type BetterOmit } from 'convex/server';
export declare const useConvexClient: () => ConvexClient;
export declare const setConvexClientContext: (client: ConvexClient) => void;
export declare const setupConvex: (url: string, options?: ConvexClientOptions) => void;
type UseQueryOptions<Query extends FunctionReference<'query'>> = {
    initialData?: FunctionReturnType<Query>;
    keepPreviousData?: boolean;
    enabled?: boolean | (() => boolean);
};
type UseQueryReturn<Query extends FunctionReference<'query'>> = {
    data: undefined;
    error: undefined;
    isLoading: true;
    isStale: false;
} | {
    data: undefined;
    error: Error;
    isLoading: false;
    isStale: boolean;
} | {
    data: FunctionReturnType<Query>;
    error: undefined;
    isLoading: false;
    isStale: boolean;
};
/**
 * Subscribe to a Convex query and return a reactive query result object.
 * Pass reactive args object or a closure returning args to update args reactively.
 *
 * @param query - a FunctionRefernece like `api.dir1.dir2.filename.func`.
 * @param args - The arguments to the query function.
 * @param options - UseQueryOptions like `initialData`, `keepPreviousData`, and `enabled` (can be boolean or function).
 * @returns an object containing data, isLoading, error, and isStale.
 */
export declare function useQuery<Query extends FunctionReference<'query'>>(query: Query, args: FunctionArgs<Query> | (() => FunctionArgs<Query>), options?: UseQueryOptions<Query> | (() => UseQueryOptions<Query>)): UseQueryReturn<Query>;
type PaginatedQuery = FunctionReference<'query', 'public', {
    paginationOpts: PaginationOptions;
}, PaginationResult<any>>;
export type PaginatedQueryItem<Query extends PaginatedQuery> = FunctionReturnType<Query>["page"][number];
type UsePaginatedQueryOptions<Query extends PaginatedQuery> = {
    initialNumItems?: number;
    initialData?: PaginationResult<FunctionReturnType<Query>>;
};
export type PaginatedQueryArgs<Query extends PaginatedQuery> = Expand<BetterOmit<FunctionArgs<Query>, "paginationOpts">>;
declare enum UsePaginationQueryStatus {
    LoadingFirstPage = "LoadingFirstPage",
    CanLoadMore = "CanLoadMore",
    LoadingMore = "LoadingMore",
    Exhausted = "Exhausted"
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
export declare function usePaginatedQuery<Query extends PaginatedQuery>(query: Query, args: PaginatedQueryArgs<Query> | (() => PaginatedQueryArgs<Query>), options?: UsePaginatedQueryOptions<Query>): UsePaginatedQueryReturn<PaginatedQueryItem<Query>>;
export {};
