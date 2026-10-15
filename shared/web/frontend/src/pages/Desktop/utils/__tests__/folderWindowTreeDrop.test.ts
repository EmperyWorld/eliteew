import { describe, expect, it } from 'vitest';
import { CM_CONTENT_DRAG_MIME } from '@/pages/ContentManager/utils/contentManagerDrag';
import { DESKTOP_NESTED_ITEM_DRAG_MIME } from '../desktopNestedItemDrag';
import { dataTransferHasFolderTreeDrop } from '../folderWindowTreeDrop';

describe('folderWindowTreeDrop', () => {
	it('detects nested item and content manager drags', () => {
		const nested = {
			types: [DESKTOP_NESTED_ITEM_DRAG_MIME],
		} as unknown as DataTransfer;
		const content = {
			types: [CM_CONTENT_DRAG_MIME],
		} as unknown as DataTransfer;
		const files = {
			types: ['Files'],
			files: { length: 1 },
		} as unknown as DataTransfer;

		expect(dataTransferHasFolderTreeDrop(nested)).toBe(true);
		expect(dataTransferHasFolderTreeDrop(content)).toBe(true);
		expect(dataTransferHasFolderTreeDrop(files)).toBe(false);
		expect(dataTransferHasFolderTreeDrop(null)).toBe(false);
	});
});
