import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ContentManagerFilesTab mobile embedded contract', () => {
	it('uses embeddedMobileLayout for column split, not md:flex-row only', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../ContentManagerFilesTab.tsx'),
			'utf8'
		);

		expect(src).toContain('embeddedMobileLayout');
		expect(src).toContain('forceColumnFilesSplit');
		expect(src).toContain('data-cm-files-split');
	});
});
