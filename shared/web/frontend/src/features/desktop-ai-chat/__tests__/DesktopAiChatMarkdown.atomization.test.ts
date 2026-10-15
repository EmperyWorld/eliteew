/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Structural lock for desktop-ai-chat-005 Markdown atomization.
 *
 * Invariants:
 * - Facade DesktopAiChatMarkdown.tsx ≤400 LOC; domain siblings ≤800 LOC.
 * - Public exports DesktopAiChatMarkdown / isTrustedChatImageUrl / parseContentDownloadApiPath remain.
 *
 * Related:
 * - DesktopAiChatMarkdown.*; documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
	DesktopAiChatMarkdown,
	isTrustedChatImageUrl,
	parseContentDownloadApiPath,
} from '@/features/desktop-ai-chat/DesktopAiChatMarkdown';

const DIR = dirname(fileURLToPath(import.meta.url));
const FEATURE = join(DIR, '..');

function loc(name: string): number {
	return readFileSync(join(FEATURE, name), 'utf8').split('\n').length;
}

describe('DesktopAiChatMarkdown atomization (desktop-ai-chat-005)', () => {
	it('keeps facade and domain modules under LOC caps', () => {
		expect(loc('DesktopAiChatMarkdown.tsx')).toBeLessThanOrEqual(400);
		for (const name of [
			'DesktopAiChatMarkdown.prose.ts',
			'DesktopAiChatMarkdown.media.tsx',
			'DesktopAiChatMarkdown.mermaid.tsx',
			'DesktopAiChatMarkdown.components.tsx',
		]) {
			expect(loc(name), name).toBeLessThanOrEqual(800);
		}
	});

	it('re-exports public markdown API', () => {
		expect(typeof DesktopAiChatMarkdown).toBe('object');
		expect(typeof isTrustedChatImageUrl).toBe('function');
		expect(typeof parseContentDownloadApiPath).toBe('function');
	});
});
