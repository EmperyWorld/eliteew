import { describe, expect, it } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import {
	buildDesktopMarkdownFileItem,
	inferDesktopFileTypeFromName,
	resolveNextMarkdownFilename,
} from '../createDesktopMarkdownFile';

function fileItem(name: string): DesktopItem {
	return {
		id: `file-${name}`,
		name,
		type: 'file',
		position: { x: 0, y: 0 },
		fileType: 'text/markdown',
		isPinned: false,
	};
}

describe('createDesktopMarkdownFile', () => {
	it('resolveNextMarkdownFilename picks first free name', () => {
		expect(resolveNextMarkdownFilename([])).toBe('Новый документ.md');
	});

	it('resolveNextMarkdownFilename skips taken names case-insensitively', () => {
		const items = [
			fileItem('Новый документ.md'),
			fileItem('Новый документ 2.MD'),
		];
		expect(resolveNextMarkdownFilename(items)).toBe('Новый документ 3.md');
	});

	it('buildDesktopMarkdownFileItem uses content id and markdown type', () => {
		const item = buildDesktopMarkdownFileItem({
			contentId: 'uc-1',
			name: 'Notes.md',
			position: { x: 120, y: 80 },
		});
		expect(item).toMatchObject({
			id: 'uc-1',
			name: 'Notes.md',
			type: 'file',
			fileType: 'text/markdown',
			position: { x: 120, y: 80 },
		});
	});

	it('inferDesktopFileTypeFromName maps common extensions', () => {
		expect(inferDesktopFileTypeFromName('a.MD')).toBe('text/markdown');
		expect(inferDesktopFileTypeFromName('readme.txt')).toBe('text/plain');
		expect(inferDesktopFileTypeFromName('data.bin')).toBeUndefined();
	});
});
