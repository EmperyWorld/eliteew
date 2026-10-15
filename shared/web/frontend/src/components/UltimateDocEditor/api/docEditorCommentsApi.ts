/**
 * Doc editor comments API (unified_content comments).
 * Used by CommentsReviewPanel for real document comments.
 */

import { API_PATHS } from '../../../services/api/config';
import { APIError, api } from '../../../services/api/client';

const BASE = API_PATHS.DOC_EDITOR;

export interface CommentThreadApi {
	id: string;
	documentId: string;
	selection: { start?: number; end?: number; text?: string };
	assignedReviewer?: {
		id: string;
		name: string;
		avatar?: string | null;
	} | null;
	isPinned?: boolean;
	isFollowing?: boolean;
	unread?: boolean;
	lastActivityAt?: string | null;
	comments: Array<{
		id: string;
		threadId: string;
		author: { id: string; name: string; avatar?: string | null };
		content: string;
		createdAt: string | null;
		resolved: boolean;
		mentions: string[];
	}>;
}

export interface CommentThreadsBulkOperationResult {
	status: 'ok';
	requested: number;
	updated: number;
	failed: number;
	updatedThreadIds: string[];
	failedThreads: Array<{ threadId: string; error: string }>;
}

export interface CommentThreadsResponse {
	threads: CommentThreadApi[];
	capabilities?: Record<string, boolean>;
}

export async function fetchCommentThreads(
	documentId: string
): Promise<CommentThreadsResponse> {
	const out = await api.get<{
		threads?: CommentThreadApi[];
		capabilities?: Record<string, boolean>;
	}>(`${BASE}/documents/${documentId}/comments`);
	return { threads: out.threads ?? [], capabilities: out.capabilities };
}

export async function createCommentThread(
	documentId: string,
	selection: { start?: number; end?: number; text?: string }
): Promise<CommentThreadApi> {
	return api.post<CommentThreadApi>(
		`${BASE}/documents/${documentId}/comments/threads`,
		{ selection }
	);
}

export async function addCommentToThread(
	documentId: string,
	threadId: string,
	content: string
): Promise<{
	id: string;
	threadId: string;
	author: { id: string; name: string; avatar?: string | null };
	content: string;
	createdAt: string | null;
	resolved: boolean;
	mentions: string[];
}> {
	return api.post<{
		id: string;
		threadId: string;
		author: { id: string; name: string; avatar?: string | null };
		content: string;
		createdAt: string | null;
		resolved: boolean;
		mentions: string[];
	}>(`${BASE}/documents/${documentId}/comments/threads/${threadId}/comments`, {
		content,
	});
}

export async function resolveCommentThread(
	documentId: string,
	threadId: string
): Promise<void> {
	await api.patch(
		`${BASE}/documents/${documentId}/comments/threads/${threadId}/resolve`,
		undefined
	);
}

export async function reopenCommentThread(
	documentId: string,
	threadId: string
): Promise<void> {
	await api.patch(
		`${BASE}/documents/${documentId}/comments/threads/${threadId}/reopen`,
		undefined
	);
}

export async function assignCommentThreadReviewer(
	documentId: string,
	threadId: string,
	reviewerId: string | null
): Promise<{
	status: 'ok';
	threadId: string;
	assignedReviewer: { id: string; name: string; avatar?: string | null } | null;
}> {
	return api.patch(
		`${BASE}/documents/${documentId}/comments/threads/${threadId}/assign`,
		{ reviewer_id: reviewerId }
	);
}

export async function pinCommentThread(
	documentId: string,
	threadId: string
): Promise<void> {
	await api.post(
		`${BASE}/documents/${documentId}/comments/threads/${threadId}/pin`,
		undefined
	);
}

export async function unpinCommentThread(
	documentId: string,
	threadId: string
): Promise<void> {
	await api.post(
		`${BASE}/documents/${documentId}/comments/threads/${threadId}/unpin`,
		undefined
	);
}

export async function followCommentThread(
	documentId: string,
	threadId: string
): Promise<void> {
	await api.post(
		`${BASE}/documents/${documentId}/comments/threads/${threadId}/follow`,
		undefined
	);
}

export async function unfollowCommentThread(
	documentId: string,
	threadId: string
): Promise<void> {
	await api.post(
		`${BASE}/documents/${documentId}/comments/threads/${threadId}/unfollow`,
		undefined
	);
}

export async function markCommentThreadRead(
	documentId: string,
	threadId: string
): Promise<void> {
	await api.post(
		`${BASE}/documents/${documentId}/comments/threads/${threadId}/mark-read`,
		undefined
	);
}

export async function resolveCommentThreadsBulk(
	documentId: string,
	threadIds: string[]
): Promise<CommentThreadsBulkOperationResult> {
	try {
		return await api.post<CommentThreadsBulkOperationResult>(
			`${BASE}/documents/${documentId}/comments/threads/bulk-resolve`,
			{ thread_ids: threadIds }
		);
	} catch (error) {
		if (
			error instanceof APIError &&
			(error.statusCode === 404 || error.statusCode === 405)
		) {
			return resolveCommentThreadsBulkFallback(documentId, threadIds);
		}
		throw error;
	}
}

export async function reopenCommentThreadsBulk(
	documentId: string,
	threadIds: string[]
): Promise<CommentThreadsBulkOperationResult> {
	try {
		return await api.post<CommentThreadsBulkOperationResult>(
			`${BASE}/documents/${documentId}/comments/threads/bulk-reopen`,
			{ thread_ids: threadIds }
		);
	} catch (error) {
		if (
			error instanceof APIError &&
			(error.statusCode === 404 || error.statusCode === 405)
		) {
			return reopenCommentThreadsBulkFallback(documentId, threadIds);
		}
		throw error;
	}
}

async function resolveCommentThreadsBulkFallback(
	documentId: string,
	threadIds: string[]
): Promise<CommentThreadsBulkOperationResult> {
	const results = await Promise.allSettled(
		threadIds.map((threadId) => resolveCommentThread(documentId, threadId))
	);
	const updatedThreadIds = threadIds.filter(
		(_, index) => results[index]?.status === 'fulfilled'
	);
	const failedThreads = threadIds
		.filter((_, index) => results[index]?.status === 'rejected')
		.map((threadId) => ({ threadId, error: 'fallback_single_request_failed' }));

	return {
		status: 'ok',
		requested: threadIds.length,
		updated: updatedThreadIds.length,
		failed: failedThreads.length,
		updatedThreadIds,
		failedThreads,
	};
}

async function reopenCommentThreadsBulkFallback(
	documentId: string,
	threadIds: string[]
): Promise<CommentThreadsBulkOperationResult> {
	const results = await Promise.allSettled(
		threadIds.map((threadId) => reopenCommentThread(documentId, threadId))
	);
	const updatedThreadIds = threadIds.filter(
		(_, index) => results[index]?.status === 'fulfilled'
	);
	const failedThreads = threadIds
		.filter((_, index) => results[index]?.status === 'rejected')
		.map((threadId) => ({ threadId, error: 'fallback_single_request_failed' }));

	return {
		status: 'ok',
		requested: threadIds.length,
		updated: updatedThreadIds.length,
		failed: failedThreads.length,
		updatedThreadIds,
		failedThreads,
	};
}
