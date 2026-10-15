/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — DesktopAiChatMessagesPane stable path stays a thin facade;
 * implementation children under components/messagesPane/ stay within LOC budget.
 *
 * Invariants:
 * - Facade ≤50 LOC; re-exports props type + View only.
 * - Each messagesPane/* child ≤800 LOC.
 * - Public import path `@/features/desktop-ai-chat/components/DesktopAiChatMessagesPane` unchanged.
 *
 * Related:
 * - ../DesktopAiChatMessagesPane.tsx
 * - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md (desktop-ai-chat-011)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
	DesktopAiChatMessagesPane,
	type DesktopAiChatMessagesPaneProps,
} from '@/features/desktop-ai-chat/components/DesktopAiChatMessagesPane';

describe('DesktopAiChatMessagesPane atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const messagesPaneDir = join(testDir, '..');
	const facadePath = join(
		messagesPaneDir,
		'..',
		'DesktopAiChatMessagesPane.tsx'
	);

	it('re-exports pane from the stable facade path', () => {
		expect(typeof DesktopAiChatMessagesPane).toBe('function');
		const _propsTypeProbe: DesktopAiChatMessagesPaneProps | null = null;
		expect(_propsTypeProbe).toBeNull();
	});

	it('facade stays ≤50 LOC and only re-exports messagesPane children', () => {
		const src = readFileSync(facadePath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(50);
		expect(src).toContain(
			"from './messagesPane/desktopAiChatMessagesPaneTypes'"
		);
		expect(src).toContain(
			"from './messagesPane/DesktopAiChatMessagesPaneView'"
		);
		expect(src).not.toMatch(/data-ai-chat-guide=/);
		expect(src).not.toMatch(/function DesktopAiChatMessagesPane\b/);
		expect(src).not.toMatch(/SecureAvatar/);
	});

	it('implementation children exist and stay ≤800 LOC each', () => {
		const expected = [
			'desktopAiChatMessagesPaneTypes.ts',
			'useDesktopAiChatLoadOlderBanner.ts',
			'DesktopAiChatLoadOlderBanner.tsx',
			'DesktopAiChatThreadStates.tsx',
			'buildDesktopAiChatMessageRowModel.ts',
			'DesktopAiChatMessageRow.tsx',
			'DesktopAiChatMessagesPaneView.tsx',
		];
		const names = new Set(
			readdirSync(messagesPaneDir).filter((n) => /\.tsx?$/.test(n))
		);
		for (const mod of expected) {
			expect(names.has(mod), mod).toBe(true);
			const lines = readFileSync(join(messagesPaneDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});
});
