/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — desktopChatClient stable path stays a thin facade;
 * implementation children under api/desktopChatClient/ stay within LOC budget.
 *
 * Invariants:
 * - Facade ≤50 LOC; re-exports types + REST + stream helpers only.
 * - Each desktopChatClient/* child ≤800 LOC.
 * - Public import path `@/features/desktop-ai-chat/api/desktopChatClient` unchanged.
 *
 * Related:
 * - ../desktopChatClient.ts
 * - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md (desktop-ai-chat-011)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
	DesktopAiSseTerminalError,
	classifyDesktopStreamError,
	formatDesktopStreamErrorBubble,
	streamDesktopAiChat,
} from '@/features/desktop-ai-chat/api/desktopChatClient';

describe('desktopChatClient atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const apiDir = join(testDir, '..');
	const facadePath = join(apiDir, 'desktopChatClient.ts');
	const implDir = join(apiDir, 'desktopChatClient');

	it('re-exports stream helpers from the stable facade path', () => {
		expect(typeof streamDesktopAiChat).toBe('function');
		expect(typeof classifyDesktopStreamError).toBe('function');
		expect(typeof formatDesktopStreamErrorBubble).toBe('function');
		expect(DesktopAiSseTerminalError.name).toBe('DesktopAiSseTerminalError');
	});

	it('facade stays ≤50 LOC and only re-exports children', () => {
		const src = readFileSync(facadePath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(50);
		expect(src).toContain("from './desktopChatClient/types'");
		expect(src).toContain("from './desktopChatClient/rest'");
		expect(src).toContain("from './desktopChatClient/stream'");
		expect(src).toContain("from './desktopChatClient/streamErrors'");
		expect(src).not.toMatch(/apiClient\.(get|post|patch|delete)/);
		expect(src).not.toMatch(/apiFetchWithAuth/);
		expect(src).not.toMatch(/function classifyDesktopStreamError/);
		expect(src).not.toMatch(/async function streamDesktopAiChat/);
	});

	it('implementation children exist and stay ≤800 LOC each', () => {
		const expected = [
			'shared.ts',
			'types.ts',
			'rest.ts',
			'streamErrors.ts',
			'stream.ts',
		];
		const names = new Set(
			readdirSync(implDir).filter((n) => /\.tsx?$/.test(n))
		);
		for (const mod of expected) {
			expect(names.has(mod), mod).toBe(true);
			const lines = readFileSync(join(implDir, mod), 'utf8').split('\n').length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});
});
