// Reexport your entry components here

export {
	useConvexClient,
	setupConvex,
	useQuery,
	setConvexClientContext,
	setupAuth,
	useAuth,
	_authContextKey,
	type UseQueryOptions,
	type UseQueryReturn,
	type UseQueryAsyncResult,
	type UseQueryAsyncReturn,
	type FetchAccessToken,
	type ConvexAuthProvider,
	type SetupAuthOptions,
	type UseAuthReturn
} from './client.svelte.js';
export { usePaginatedQuery } from './use_paginated_query.svelte.js';
export { getConvexClient } from './internal/singleton.js';
