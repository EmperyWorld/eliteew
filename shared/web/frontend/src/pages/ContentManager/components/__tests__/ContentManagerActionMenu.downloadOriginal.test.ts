/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock «Скачать оригинал» label for image context menu.
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

describe('ContentActionMenu download original', () => {
	it('uses downloadOriginal for image content_type', () => {
		const source = readFileSync(
			join(here, '../ContentManagerActionMenu.tsx'),
			'utf8'
		);
		expect(source).toContain("item.content_type === 'image'");
		expect(source).toContain("t('pro.menu.downloadOriginal')");
	});
});
