/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve comment/review action gates from server capabilities only (deny when unknown).
 *
 * Invariants:
 * - Missing/null capabilities → all can* false (never infer from permissionRole).
 *
 * Related:
 * - CommentsReviewPanel.tsx
 * - documentation/product/DOCUMENT-EDITOR-V2.md §5.2
 */

export type CommentPanelCapabilityFlags = {
	canWriteComments: boolean;
	canManageThreads: boolean;
	canResolveThreads: boolean;
	canAssignReviewer: boolean;
	capabilitiesKnown: boolean;
};

export function resolveCommentPanelCapabilities(
	apiCapabilities: Record<string, boolean> | null | undefined
): CommentPanelCapabilityFlags {
	if (apiCapabilities == null) {
		return {
			canWriteComments: false,
			canManageThreads: false,
			canResolveThreads: false,
			canAssignReviewer: false,
			capabilitiesKnown: false,
		};
	}
	return {
		canWriteComments: Boolean(apiCapabilities['comment.write']),
		canManageThreads: Boolean(
			apiCapabilities['review.assign'] || apiCapabilities['review.resolve']
		),
		canResolveThreads: Boolean(apiCapabilities['review.resolve']),
		canAssignReviewer: Boolean(apiCapabilities['review.assign']),
		capabilitiesKnown: true,
	};
}
