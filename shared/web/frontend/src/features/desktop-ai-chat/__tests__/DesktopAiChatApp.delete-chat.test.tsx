/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract test for delete-chat confirmation flow in DesktopAiChatApp.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopAiChatApp delete chat flow', () => {
	it('opens confirm modal with i18n keys before deleteDesktopAiChat', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const viewSrc = readFileSync(
			join(dir, '../app/DesktopAiChatAppView.tsx'),
			'utf8'
		);
		const overlaysSrc = readFileSync(
			join(dir, '../app/DesktopAiChatAppOverlays.tsx'),
			'utf8'
		);
		const actionsSrc = readFileSync(
			join(dir, '../app/useDesktopAiChatAppShellActions.ts'),
			'utf8'
		);

		expect(viewSrc).toContain('requestDeleteChat');
		expect(viewSrc).toContain('<DesktopAiChatAppOverlays');
		expect(overlaysSrc).toContain('deleteChatConfirmOpen');
		expect(overlaysSrc).toContain('handleDeleteChat');
		expect(overlaysSrc).toContain("t('deleteChatConfirmTitle')");
		expect(overlaysSrc).toContain("t('deleteChatConfirmBody')");
		expect(overlaysSrc).toContain("t('deleteChatConfirmButton')");
		expect(overlaysSrc).toContain("t('deleteChatConfirmLoading')");
		expect(actionsSrc).toContain('deleteDesktopAiChat');
		expect(overlaysSrc).toContain('ConfirmDeleteModal');
	});
});
