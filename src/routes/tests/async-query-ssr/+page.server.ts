import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '../../../convex/_generated/api.js';

export async function load() {
	const client = new ConvexHttpClient(PUBLIC_CONVEX_URL!);
	const messages = await client.query(api.messages.list, { muteWords: [] });
	return { messages };
}
