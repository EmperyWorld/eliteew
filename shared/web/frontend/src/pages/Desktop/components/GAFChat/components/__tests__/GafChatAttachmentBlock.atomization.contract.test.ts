/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract: GafChatAttachmentBlock parent ≤800 LOC with named export
 * and extracted inline-audio, preview hook, and preview modal modules.
 *
 * Invariants:
 * - Parent GafChatAttachmentBlock.tsx ≤800 lines; named export remains there.
 * - Required child modules exist and stay ≤800 each.
 *
 * Related:
 * - GafChatAttachmentBlock.tsx
 * - documentation/product/GAF-CHAT-DESKTOP-REFERENCE.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(dir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('GafChatAttachmentBlock atomization contract', () => {
	const parentPath = join(componentsDir, 'GafChatAttachmentBlock.tsx');
	const children = [
		'GafChatInlineAudioPlayer.tsx',
		'useGafAttachmentPreview.ts',
		'GafChatAttachmentPreviewModal.tsx',
	] as const;

	it('parent GafChatAttachmentBlock.tsx is ≤800 LOC with named export', () => {
		const src = read(parentPath);
		expect(lineCount(parentPath)).toBeLessThanOrEqual(800);
		expect(src).toMatch(/export\s+function\s+GafChatAttachmentBlock\b/);
	});

	it('wires extracted inline-audio, preview hook, and preview modal modules', () => {
		const src = read(parentPath);
		expect(src).toContain("from './GafChatInlineAudioPlayer'");
		expect(src).toContain("from './useGafAttachmentPreview'");
		expect(src).toContain("from './GafChatAttachmentPreviewModal'");
		expect(src).toContain('<GafChatInlineAudioPlayer');
		expect(src).toContain('useGafAttachmentPreview(');
		expect(src).toContain('<GafChatAttachmentPreviewModal');
	});

	it('child modules exist and are ≤800 LOC each', () => {
		for (const name of children) {
			const path = join(componentsDir, name);
			expect(lineCount(path)).toBeLessThanOrEqual(800);
		}
	});
});
