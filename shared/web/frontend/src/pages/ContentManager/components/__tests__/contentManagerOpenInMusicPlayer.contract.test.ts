/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Content Manager audio ПКМ → Open in Music Player wiring.
 *
 * Related:
 * - ContentManagerActionMenu.tsx, ContentManagerFileRow.tsx
 * - documentation/product/CONTENT-MANAGER.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Content Manager open in Music Player', () => {
	it('exposes audio ПКМ action on the shared menu', () => {
		const menu = stripComments(readSrc('../ContentManagerActionMenu.tsx'));
		expect(menu).toContain('onPlayInMusicPlayer');
		expect(menu).toContain("item.content_type === 'audio'");
		expect(menu).toContain('pro.menu.openInMusicPlayer');
	});

	it('wires row and card to requestPlayAndOpenMusicPlayer', () => {
		const row = stripComments(readSrc('../ContentManagerFileRow.tsx'));
		const card = stripComments(readSrc('../ContentManagerFileCard.tsx'));
		expect(row).toContain('requestPlayAndOpenMusicPlayer');
		expect(row).toContain('handleMenuPlayInMusicPlayer');
		expect(card).toContain('requestPlayAndOpenMusicPlayer');
		expect(card).toContain('handleMenuPlayInMusicPlayer');
	});
});
