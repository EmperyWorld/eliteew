import type { Content as ContentItem } from '../../../components/UnifiedContent/types';

/** Document-like types for «Open in» (chat / editor). */
export function isOpenInDocumentType(contentType: string): boolean {
	const t = (contentType || '').toLowerCase();
	return (
		t === 'document' ||
		t === 'text' ||
		t === 'pdf' ||
		t === 'spreadsheet' ||
		t === 'presentation' ||
		t === 'code'
	);
}

export const INLINE_PREVIEW_TYPES = ['image', 'video', 'audio'] as const;

export function canInlinePreview(type: string): boolean {
	return INLINE_PREVIEW_TYPES.includes(
		type as (typeof INLINE_PREVIEW_TYPES)[number]
	);
}

/** Visibility label: «from friends» for others' files in friends context (even if API said public). */
export function getDisplayVisibility(
	item: ContentItem,
	filterVisibility: 'all' | 'private' | 'shared' | 'friends' | 'from_friends'
): string {
	if (item.is_owner) return item.visibility ?? 'private';
	if (item.visibility === 'friends') return 'from_friends';
	if (
		(filterVisibility === 'friends' || filterVisibility === 'from_friends') &&
		item.visibility === 'public'
	)
		return 'from_friends';
	return item.visibility ?? 'private';
}
