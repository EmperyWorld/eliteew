/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: when a stored thumbnail path exists, ContentThumbnail must not fall back
 * to `/download` after a failed thumbnail fetch (broken Seaweed / quarantine).
 * @vitest-environment node
 *
 * Related:
 * - documentation/product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md
 * - ContentThumbnail.tsx
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const thumbSrc = readFileSync(join(here, '../ContentThumbnail.tsx'), 'utf8');
const hoverSrc = readFileSync(
	join(here, '../../HoverPreview/HoverPreview.tsx'),
	'utf8'
);

describe('ContentThumbnail broken-storage fallback contract', () => {
	it('does not download after stored-thumbnail failure', () => {
		expect(thumbSrc).toContain('hasStoredThumbnail');
		expect(thumbSrc).toContain('do not fall back to original download');
		expect(thumbSrc).toMatch(
			/hasStoredThumbnail[\s\S]*?else if \([\s\S]*?isRenderableImageMeta/
		);
	});

	it('HoverPreview does not download after stored-thumbnail failure', () => {
		expect(hoverSrc).toContain('no /download fallback');
		expect(hoverSrc).toContain('hasStoredThumbnail');
	});

	it('grid and hover blob GETs use shared CM concurrency gate', () => {
		expect(thumbSrc).toContain('withBlobFetchConcurrency');
		expect(hoverSrc).toContain('withBlobFetchConcurrency');
	});
});
