import type { Content as ContentItem } from '../../../components/UnifiedContent/types';

/** Document-like types that run DocumentProcessor (preview / extracted_text). */
export function canReprocessUnifiedContentDisplay(item: ContentItem): boolean {
	if (item.can_edit === false) {
		return false;
	}
	const t = item.content_type;
	return t === 'document' || t === 'presentation' || t === 'spreadsheet';
}

export function isUnifiedContentProcessingFailed(item: ContentItem): boolean {
	return String(item.processing_status ?? '').toLowerCase() === 'failed';
}

/** Owner/edit retry: failed pipeline for any stored file, or display refresh for document-like types. */
export function canReprocessUnifiedContent(item: ContentItem): boolean {
	if (item.can_edit === false) {
		return false;
	}
	if (isUnifiedContentProcessingFailed(item)) {
		return true;
	}
	return canReprocessUnifiedContentDisplay(item);
}

export function reprocessMenuLabelKey(
	item: ContentItem
): 'pro.menu.reprocessFailed' | 'pro.menu.reprocessDisplay' {
	return isUnifiedContentProcessingFailed(item)
		? 'pro.menu.reprocessFailed'
		: 'pro.menu.reprocessDisplay';
}
