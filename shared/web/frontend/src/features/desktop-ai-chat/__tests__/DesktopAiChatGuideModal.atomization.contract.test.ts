/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Structural lock for desktop-ai-chat-026 Guide modal atomization.
 *
 * Invariants:
 * - Facade stays under soft LOC cap; guide/* children exist.
 * - Public ROOT_ID / TOUR_FOLDER / wav helper remain on facade.
 *
 * Related:
 * - features/desktop-ai-chat/DesktopAiChatGuideModal.tsx
 * - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	DESKTOP_AI_CHAT_GUIDE_TOUR_FOLDER,
	DESKTOP_AI_CHAT_ROOT_ID,
	desktopAiChatGuideWavUrl,
} from '../DesktopAiChatGuideModal';

const dir = dirname(fileURLToPath(import.meta.url));
const featureRoot = join(dir, '..');

function loc(rel: string): number {
	return readFileSync(join(featureRoot, rel), 'utf8').split('\n').length;
}

describe('DesktopAiChatGuideModal atomization (026)', () => {
	it('keeps public facade exports', () => {
		expect(DESKTOP_AI_CHAT_ROOT_ID).toBe('desktop-ai-chat-app-root');
		expect(DESKTOP_AI_CHAT_GUIDE_TOUR_FOLDER).toBe('desktop-ai-chat-guide');
		expect(desktopAiChatGuideWavUrl('intro')).toContain(
			'desktop-ai-chat-guide'
		);
	});

	it('splits placement/spotlight/steps under LOC caps', () => {
		expect(loc('DesktopAiChatGuideModal.tsx')).toBeLessThanOrEqual(750);
		expect(loc('guide/desktopAiChatGuidePlacement.ts')).toBeLessThanOrEqual(
			200
		);
		expect(
			loc('guide/DesktopAiChatGuideSpotlightFrame.tsx')
		).toBeLessThanOrEqual(200);
		expect(loc('guide/desktopAiChatGuideSteps.tsx')).toBeLessThanOrEqual(100);
	});
});
