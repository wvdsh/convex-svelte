import { ConvexHttpClient } from 'convex/browser';
import type { PageServerLoad } from './$types.js';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '../convex/_generated/api.js';

export const load = (async () => {
	const client = new ConvexHttpClient(PUBLIC_CONVEX_URL!);
	const messagesResult = await client.query(api.messages.list, { 
		paginationOpts: { numItems: 50, cursor: null },
		muteWords: [] 
	});
	return {
		messagesResult: messagesResult
	};
}) satisfies PageServerLoad;
