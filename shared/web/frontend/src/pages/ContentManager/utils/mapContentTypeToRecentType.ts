/**
 * Maps unified_content `content_type` to desktop "recent files" category.
 */
export type RecentContentCategory =
	| 'document'
	| 'image'
	| 'audio'
	| 'video'
	| 'folder';

export function mapContentTypeToRecentType(
	contentType: string
): RecentContentCategory {
	if (
		contentType === 'document' ||
		contentType === 'text' ||
		contentType === 'pdf' ||
		contentType === 'spreadsheet' ||
		contentType === 'presentation' ||
		contentType === 'code' ||
		contentType === 'ai_result'
	) {
		return 'document';
	}
	if (contentType === 'image') {
		return 'image';
	}
	if (contentType === 'audio') {
		return 'audio';
	}
	if (contentType === 'video') {
		return 'video';
	}
	return 'document';
}
