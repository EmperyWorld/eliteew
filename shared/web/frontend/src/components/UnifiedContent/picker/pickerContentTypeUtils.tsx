import {
	ContentType,
	type ContentType as ContentTypeT,
} from '@/types/fileExchange';
import type * as React from 'react';
import {
	DocumentIcon,
	DocumentTextIcon,
	MusicalNoteIcon,
	PhotoIcon,
	VideoCameraIcon,
} from '@heroicons/react/24/outline';

/**
 * Нормализация content_type из API (и по mime), как в FileGrabber.
 */
export function normalizePickerContentType(file: {
	content_type?: string;
	mime_type?: string | null;
}): ContentTypeT {
	if (
		file.content_type &&
		Object.values(ContentType).includes(file.content_type as ContentTypeT)
	) {
		return file.content_type as ContentTypeT;
	}

	const mimeType = file.mime_type?.toLowerCase() || '';

	if (
		mimeType.includes('pdf') ||
		mimeType.includes('word') ||
		mimeType.includes('document') ||
		mimeType.includes('text') ||
		mimeType.includes('html') ||
		mimeType.includes('markdown') ||
		mimeType.includes('rtf') ||
		mimeType.includes('application/vnd') ||
		mimeType.includes('application/msword') ||
		mimeType.includes('application/vnd.openxmlformats')
	) {
		return ContentType.DOCUMENT;
	}

	if (mimeType.startsWith('image/')) {
		return ContentType.IMAGE;
	}
	if (mimeType.startsWith('video/')) {
		return ContentType.VIDEO;
	}
	if (mimeType.startsWith('audio/')) {
		return ContentType.AUDIO;
	}

	return ContentType.OTHER;
}

const CONTENT_TYPE_ICON_STYLES: Record<ContentTypeT, string> = {
	[ContentType.DOCUMENT]: 'text-blue-300',
	[ContentType.IMAGE]: 'text-pink-300',
	[ContentType.VIDEO]: 'text-violet-300',
	[ContentType.AUDIO]: 'text-emerald-300',
	[ContentType.OTHER]: 'text-(--desktop-text-secondary)',
};

export const PICKER_CONTENT_TYPE_BADGE_STYLES: Record<ContentTypeT, string> = {
	[ContentType.DOCUMENT]: 'border-blue-400/30 bg-blue-500/15 text-blue-200',
	[ContentType.IMAGE]: 'border-pink-400/30 bg-pink-500/15 text-pink-200',
	[ContentType.VIDEO]: 'border-violet-400/30 bg-violet-500/15 text-violet-200',
	[ContentType.AUDIO]:
		'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
	[ContentType.OTHER]:
		'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)',
};

export function pickerContentTypeLabel(contentType: ContentTypeT): string {
	switch (contentType) {
		case ContentType.DOCUMENT:
			return 'Документы';
		case ContentType.IMAGE:
			return 'Изображения';
		case ContentType.VIDEO:
			return 'Видео';
		case ContentType.AUDIO:
			return 'Аудио';
		default:
			return contentType.charAt(0).toUpperCase() + contentType.slice(1);
	}
}

export function PickerContentTypeIcon({
	contentType,
}: {
	contentType: ContentTypeT;
}): React.ReactElement {
	const iconClassName =
		CONTENT_TYPE_ICON_STYLES[contentType] ??
		CONTENT_TYPE_ICON_STYLES[ContentType.OTHER];

	switch (contentType) {
		case ContentType.DOCUMENT:
			return <DocumentTextIcon className={`h-5 w-5 ${iconClassName}`} />;
		case ContentType.IMAGE:
			return <PhotoIcon className={`h-5 w-5 ${iconClassName}`} />;
		case ContentType.VIDEO:
			return <VideoCameraIcon className={`h-5 w-5 ${iconClassName}`} />;
		case ContentType.AUDIO:
			return <MusicalNoteIcon className={`h-5 w-5 ${iconClassName}`} />;
		default:
			return <DocumentIcon className={`h-5 w-5 ${iconClassName}`} />;
	}
}
