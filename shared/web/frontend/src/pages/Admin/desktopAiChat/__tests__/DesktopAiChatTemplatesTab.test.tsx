/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopAiChatTemplatesTab contract', () => {
	it('wires CRUD API helpers and confirm delete', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../DesktopAiChatTemplatesTab.tsx'),
			'utf8'
		);
		expect(src).toContain('createDesktopAiChatPromptTemplate');
		expect(src).toContain('patchDesktopAiChatPromptTemplate');
		expect(src).toContain('deleteDesktopAiChatPromptTemplate');
		expect(src).toContain('ConfirmDeleteModal');
		expect(src).toContain('useDesktopAiDialogFocusTrap');
	});
});
