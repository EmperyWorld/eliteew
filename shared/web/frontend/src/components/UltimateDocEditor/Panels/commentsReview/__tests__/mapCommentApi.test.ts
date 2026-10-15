/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for comment API mappers and selection normalization.
 *
 * Related:
 * - mapCommentApi.ts
 */

import { describe, expect, it } from 'vitest';

import {
	mapAddedCommentToComment,
	mapApiCommentToComment,
	mapApiThreadToCommentThread,
	normalizeCommentThreadSelection,
} from '@/components/UltimateDocEditor/Panels/commentsReview/mapCommentApi';

describe('mapCommentApi', () => {
	it('normalizeCommentThreadSelection rejects partial payloads', () => {
		expect(normalizeCommentThreadSelection(null)).toBeUndefined();
		expect(normalizeCommentThreadSelection(undefined)).toBeUndefined();
		expect(
			normalizeCommentThreadSelection({
				start: 1,
				end: 'x',
				text: 'hi',
			} as never)
		).toBeUndefined();
		expect(
			normalizeCommentThreadSelection({ start: 1, end: 5, text: 'hello' })
		).toEqual({ start: 1, end: 5, text: 'hello' });
	});

	it('mapApiCommentToComment defaults author and dates', () => {
		const mapped = mapApiCommentToComment({
			id: 'c1',
			threadId: 't1',
			author: null as never,
			content: 'hi',
			createdAt: null,
			resolved: false,
			mentions: [],
		});
		expect(mapped.author.name).toBe('User');
		expect(mapped.createdAt).toBeInstanceOf(Date);
	});

	it('mapApiThreadToCommentThread maps flags and nested comments', () => {
		const mapped = mapApiThreadToCommentThread({
			id: 't1',
			documentId: 'd1',
			selection: { start: 0, end: 3, text: 'abc' },
			assignedReviewer: null,
			isPinned: true,
			isFollowing: false,
			unread: true,
			lastActivityAt: '2026-07-29T00:00:00.000Z',
			comments: [
				{
					id: 'c1',
					threadId: 't1',
					author: { id: 'u1', name: 'Alice', avatar: null },
					content: 'note',
					createdAt: '2026-07-29T00:00:00.000Z',
					resolved: false,
					mentions: ['alice'],
				},
			],
		});
		expect(mapped.isPinned).toBe(true);
		expect(mapped.isFollowing).toBe(false);
		expect(mapped.unread).toBe(true);
		expect(mapped.comments).toHaveLength(1);
		expect(mapped.selection?.text).toBe('abc');
	});

	it('mapAddedCommentToComment uses fallback author', () => {
		const mapped = mapAddedCommentToComment(
			{
				id: 'c2',
				threadId: 't2',
				author: null as never,
				content: 'reply',
				createdAt: null,
				resolved: false,
				mentions: [],
			},
			{ id: 'u9', name: 'Fallback' }
		);
		expect(mapped.author.name).toBe('Fallback');
	});
});
