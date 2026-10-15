import type { CommentThread } from '../types/editor.types';

export function getNextActionableThreadId(
	sortedThreads: CommentThread[],
	currentFocusedThreadId: string | null | undefined,
	currentUserId: string
): string | null {
	if (sortedThreads.length === 0) {
		return null;
	}

	const actionable = sortedThreads.filter((thread) => {
		const unresolved = thread.comments.some((comment) => !comment.resolved);
		return (
			unresolved &&
			(thread.assignedReviewer?.id === currentUserId ||
				!thread.assignedReviewer)
		);
	});

	if (actionable.length === 0) {
		return null;
	}

	const currentIndex = actionable.findIndex(
		(thread) => thread.id === currentFocusedThreadId
	);
	const nextIndex =
		currentIndex === -1 ? 0 : (currentIndex + 1) % actionable.length;
	return actionable[nextIndex]?.id ?? null;
}
