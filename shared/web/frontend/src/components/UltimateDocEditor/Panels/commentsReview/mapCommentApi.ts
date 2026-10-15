/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Maps doc-editor comment API DTOs to panel CommentThread / Comment models.
 *
 * Invariants:
 * - Invalid selection payloads normalize to undefined (never partial anchors).
 *
 * Related:
 * - docEditorCommentsApi.ts, useCommentsReviewQueries.ts
 */

import type { CommentThreadApi } from '@/components/UltimateDocEditor/api/docEditorCommentsApi';
import type {
	Comment,
	CommentThread,
} from '@/components/UltimateDocEditor/types/editor.types';

import type { ThreadSelection } from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewTypes';

export function normalizeCommentThreadSelection(
	sel: CommentThreadApi['selection'] | ThreadSelection | null | undefined
): CommentThread['selection'] {
	if (sel == null) return undefined;
	const { start, end, text } = sel;
	if (
		typeof start !== 'number' ||
		typeof end !== 'number' ||
		typeof text !== 'string'
	) {
		return undefined;
	}
	return { start, end, text };
}

export function mapApiCommentToComment(
	c: CommentThreadApi['comments'][number]
): Comment {
	const author = c.author ?? { id: '', name: 'User', avatar: undefined };
	return {
		id: c.id,
		threadId: c.threadId,
		author: {
			id: author.id,
			name: author.name,
			avatar: author.avatar ?? undefined,
		},
		content: c.content,
		createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
		resolved: c.resolved ?? false,
		mentions: c.mentions ?? [],
	};
}

export function mapApiThreadToCommentThread(
	t: CommentThreadApi
): CommentThread {
	return {
		id: t.id,
		documentId: t.documentId,
		selection: normalizeCommentThreadSelection(t.selection),
		assignedReviewer: t.assignedReviewer
			? {
					id: t.assignedReviewer.id,
					name: t.assignedReviewer.name,
					avatar: t.assignedReviewer.avatar ?? undefined,
				}
			: null,
		isPinned: Boolean(t.isPinned),
		isFollowing: t.isFollowing ?? true,
		unread: Boolean(t.unread),
		lastActivityAt: t.lastActivityAt ? new Date(t.lastActivityAt) : null,
		comments: (t.comments ?? []).map(mapApiCommentToComment),
	};
}

export function mapAddedCommentToComment(
	added: {
		id: string;
		threadId: string;
		author: { id: string; name: string; avatar?: string | null };
		content: string;
		createdAt: string | null;
		resolved: boolean;
		mentions: string[];
	},
	fallbackAuthor: { id: string; name: string; avatar?: string } | undefined
): Comment {
	const author = added.author ?? fallbackAuthor ?? { id: '', name: 'User' };
	return {
		id: added.id,
		threadId: added.threadId,
		author: {
			id: author.id,
			name: author.name,
			avatar: author.avatar ?? undefined,
		},
		content: added.content,
		createdAt: added.createdAt ? new Date(added.createdAt) : new Date(),
		resolved: added.resolved ?? false,
		mentions: added.mentions ?? [],
	};
}
