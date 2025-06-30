import { ConvexError, v } from 'convex/values';
import { query, mutation, internalMutation } from './_generated/server.js';
import type { Doc } from './_generated/dataModel.js';
import { LoremIpsum } from 'lorem-ipsum';
import { paginationOptsValidator } from 'convex/server';

export const error = query(() => {
	throw new ConvexError('this is a Convex error');
});

export const list = query({
	args: {
		paginationOpts: paginationOptsValidator,
		muteWords: v.optional(v.array(v.string()))
	},
	handler: async (ctx, args) => {
		const { paginationOpts, muteWords = [] } = args;
		
		// Query messages ordered by creation time (newest first)
		const results = await ctx.db
			.query('messages')
			.order('desc')
			.paginate(paginationOpts);
		
		// Apply mute words filter after pagination if needed
		if (muteWords.length > 0) {
			// Filter the page results
			const filteredPage = {
				...results,
				page: results.page.filter(
					(message) => !muteWords.some((word) => 
						message.body.toLowerCase().includes(word.toLowerCase())
					)
				)
			};
			
			return filteredPage;
		}

		
		return results;
	}
});

export const send = mutation({
	args: { body: v.string(), author: v.string() },
	handler: async (ctx, { body, author }) => {
		const message = { body, author };
		await ctx.db.insert('messages', message);
	}
});

import seedMessages from './seed_messages.js';
export const seed = internalMutation({
	handler: async (ctx) => {
		const existingMessages = await ctx.db.query('messages').collect();
		if (existingMessages.length >= 10000) return;

		const lorem = new LoremIpsum({
			sentencesPerParagraph: {
				max: 8,
				min: 4
			},
			wordsPerSentence: {
				max: 16,
				min: 4
			}
		});

		const authors = ['Tom', 'Sujay', 'James', 'Arnold', 'Sarah', 'Emma', 'John', 'Lisa', 'Mike', 'Anna'];
		
		// Generate messages in batches to avoid timeout
		const batchSize = 5;
		const totalMessages = 200 - existingMessages.length;
		
		for (let i = 0; i < totalMessages; i += batchSize) {
			const batch = [];
			const currentBatchSize = Math.min(batchSize, totalMessages - i);
			
			for (let j = 0; j < currentBatchSize; j++) {
				const author = authors[Math.floor(Math.random() * authors.length)];
				const body = lorem.generateSentences(Math.floor(Math.random() * 3) + 1);
				batch.push({ author, body });
			}
			
			// Insert batch
			await Promise.all(batch.map(message => ctx.db.insert('messages', message)));
		}
		
		console.log(`Seeded ${totalMessages} messages`);
	}
});
