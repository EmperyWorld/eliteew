import { describe, expect, it } from 'vitest';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import {
	contentManagerDisplayLabel,
	isTextLikeContent,
	resolvedContentDownloadFileName,
} from './contentManagerTextLike';

function item(
	partial: Partial<ContentItem> & { id: string; name: string }
): ContentItem {
	return {
		id: partial.id,
		name: partial.name,
		content_type: partial.content_type ?? 'other',
		file_size: partial.file_size ?? 100,
		mime_type: partial.mime_type ?? null,
		created_at: partial.created_at ?? new Date(0).toISOString(),
		updated_at: partial.updated_at ?? new Date(0).toISOString(),
		user_id: partial.user_id ?? 'u1',
		visibility: partial.visibility ?? 'private',
		tags: partial.tags ?? [],
		...(partial.original_filename !== undefined
			? { original_filename: partial.original_filename }
			: {}),
	};
}

describe('isTextLikeContent', () => {
	it('detects text/* mime', () => {
		expect(
			isTextLikeContent(
				item({
					id: '1',
					name: 'x.bin',
					mime_type: 'text/plain',
					content_type: 'other',
				})
			)
		).toBe(true);
	});

	it('detects application/json', () => {
		expect(
			isTextLikeContent(
				item({
					id: '2',
					name: 'data',
					mime_type: 'application/json',
					content_type: 'other',
				})
			)
		).toBe(true);
	});

	it('uses extension when mime missing', () => {
		expect(
			isTextLikeContent(
				item({
					id: '3',
					name: 'README.md',
					mime_type: null,
					content_type: 'other',
				})
			)
		).toBe(true);
	});

	it('treats text/code content_type as text-like', () => {
		expect(
			isTextLikeContent(
				item({
					id: '4',
					name: 'blob',
					mime_type: null,
					content_type: 'text',
				})
			)
		).toBe(true);
	});

	it('rejects arbitrary binary names', () => {
		expect(
			isTextLikeContent(
				item({
					id: '5',
					name: 'photo.webp',
					mime_type: 'image/webp',
					content_type: 'image',
				})
			)
		).toBe(false);
	});

	it('uses original_filename for text-like extension when display name has none', () => {
		expect(
			isTextLikeContent(
				item({
					id: '6',
					name: 'Моя заметка',
					original_filename: 'note.md',
					mime_type: null,
					content_type: 'document',
				})
			)
		).toBe(true);
	});
});

describe('contentManagerDisplayLabel', () => {
	it('prefers title over name', () => {
		expect(
			contentManagerDisplayLabel({
				name: 'slug_internal',
				title: 'Человекочитаемый заголовок',
			})
		).toBe('Человекочитаемый заголовок');
	});

	it('falls back to name when title empty', () => {
		expect(
			contentManagerDisplayLabel({
				name: 'only_name',
				title: null,
			})
		).toBe('only_name');
	});
});

describe('resolvedContentDownloadFileName', () => {
	it('uses list title plus extension from original_filename (desktop-ai style)', () => {
		expect(
			resolvedContentDownloadFileName({
				name: 'Чат: Группировка',
				original_filename: 'desktop-ai-chat_Чат_Группировка_ecf49fb9.md',
			})
		).toBe('Чат Группировка.md');
	});

	it('keeps display name when it already has the same extension', () => {
		expect(
			resolvedContentDownloadFileName({
				name: 'Notes.md',
				original_filename: 'slug_ecf49fb9.md',
			})
		).toBe('Notes.md');
	});

	it('falls back to original when name empty', () => {
		expect(
			resolvedContentDownloadFileName({
				name: ' ',
				original_filename: 'only.md',
			})
		).toBe('only.md');
	});

	it('uses API title for download base when name is slug', () => {
		expect(
			resolvedContentDownloadFileName({
				name: 'desktop_file_test',
				title: 'Мой документ',
				original_filename: 'desktop_file_test.md',
			})
		).toBe('Мой документ.md');
	});
});
