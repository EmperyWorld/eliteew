import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { unifiedContentDisplayLabel } from '../../../components/UnifiedContent/utils/contentDisplayLabel';

const TEXT_LIKE_EXTENSIONS = new Set([
	'txt',
	'text',
	'md',
	'markdown',
	'csv',
	'tsv',
	'log',
	'json',
	'jsonl',
	'yaml',
	'yml',
	'xml',
	'html',
	'htm',
	'css',
	'scss',
	'sass',
	'less',
	'ts',
	'tsx',
	'js',
	'jsx',
	'mjs',
	'cjs',
	'vue',
	'svelte',
	'py',
	'rb',
	'go',
	'rs',
	'java',
	'kt',
	'swift',
	'php',
	'sql',
	'graphql',
	'sh',
	'bash',
	'zsh',
	'ps1',
	'env',
	'gitignore',
	'dockerignore',
	'toml',
	'ini',
	'cfg',
	'conf',
	'properties',
	'cmake',
	'makefile',
	'gradle',
	'plist',
]);

const TEXT_LIKE_MIME_EXACT = new Set([
	'application/json',
	'application/xml',
	'application/javascript',
	'application/x-yaml',
	'application/yaml',
	'application/x-www-form-urlencoded',
	'text/markdown',
	'text/x-markdown',
]);

const WIN_INVALID_FILENAME_SINGLE = new Set('<>:"/\\|?*'.split(''));

function sanitizeDownloadFileBase(name: string): string {
	const leaf = name.split(/[/\\]/).pop()?.trim() ?? name.trim();
	const cleaned = [...leaf]
		.map((ch) => {
			const code = ch.charCodeAt(0);
			if (code >= 0 && code < 32) {
				return ' ';
			}
			return WIN_INVALID_FILENAME_SINGLE.has(ch) ? ' ' : ch;
		})
		.join('');
	return cleaned.replace(/\s+/g, ' ').trim();
}

function extensionFromStorageFileName(storageName: string): string {
	const base = storageName.split(/[/\\]/).pop() ?? storageName;
	const i = base.lastIndexOf('.');
	if (i <= 0 || i >= base.length - 1) {
		return '';
	}
	return base.slice(i);
}

/** Подпись в списке/скачивании: `title`, если задан, иначе `name` (как GET /content и Content-Disposition). */
export const contentManagerDisplayLabel = unifiedContentDisplayLabel;

/**
 * Имя для эвристик превью (расширение из реального файла): `original_filename` иначе подпись списка.
 */
export function resolvedContentListFileName(
	item: Pick<ContentItem, 'name' | 'original_filename' | 'title'>
): string {
	const o = item.original_filename?.trim();
	if (o) {
		return o;
	}
	return contentManagerDisplayLabel(item);
}

/**
 * Имя при «Скачать» в контент-менеджере: подпись из списка (`title` или `name`) + расширение из `original_filename`,
 * без служебных slug вроде `desktop-ai-chat_…_id.md`, если в списке показано человекочитаемое имя.
 */
export function resolvedContentDownloadFileName(
	item: Pick<ContentItem, 'name' | 'original_filename' | 'title'>
): string {
	const rawOrig = item.original_filename?.trim();
	const display = sanitizeDownloadFileBase(contentManagerDisplayLabel(item));
	if (!display && !rawOrig) {
		return 'download';
	}
	if (!display) {
		return (
			sanitizeDownloadFileBase(rawOrig ?? 'download').slice(0, 240) ||
			'download'
		);
	}
	if (!rawOrig) {
		return display.slice(0, 240);
	}
	const ext = extensionFromStorageFileName(rawOrig);
	if (!ext) {
		return display.slice(0, 240);
	}
	const lower = display.toLowerCase();
	if (lower.endsWith(ext.toLowerCase())) {
		return display.slice(0, 240);
	}
	const leaf = display.split(/[/\\]/).pop() ?? display;
	if (leaf.includes('.')) {
		return display.slice(0, 240);
	}
	return `${display}${ext}`.slice(0, 240);
}

/** Whether preview should treat file body as decodable text (modal / TextPreview). */
export function isTextLikeContent(item: ContentItem): boolean {
	const mime = (item.mime_type ?? '').trim().toLowerCase();
	if (mime.startsWith('text/')) {
		return true;
	}
	if (TEXT_LIKE_MIME_EXACT.has(mime)) {
		return true;
	}

	const ct = (item.content_type ?? '').trim().toLowerCase();
	if (ct === 'text' || ct === 'code') {
		return true;
	}

	const base =
		resolvedContentListFileName(item).split(/[/\\]/).pop() ?? item.name;
	const lower = base.toLowerCase();
	if (lower === 'dockerfile' || lower === 'jenkinsfile') {
		return true;
	}
	const dot = lower.lastIndexOf('.');
	if (dot <= 0 || dot === lower.length - 1) {
		return false;
	}
	const ext = lower.slice(dot + 1);
	return TEXT_LIKE_EXTENSIONS.has(ext);
}
