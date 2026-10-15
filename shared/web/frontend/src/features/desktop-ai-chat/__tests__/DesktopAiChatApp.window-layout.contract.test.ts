import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopAiChatApp window layout contract', () => {
	it('uses desktop surface sizing to switch into compact in-window mode', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const appSrc = readFileSync(
			join(dir, '../app/useDesktopAiChatAppCompose.ts'),
			'utf8'
		);
		const headerSrc = readFileSync(
			join(dir, '../components/DesktopAiChatMainHeader.tsx'),
			'utf8'
		);

		expect(appSrc).toContain('useDesktopSurfaceLayout');
		expect(appSrc).toContain('compactWidth: 1040');
		expect(headerSrc).toContain("t('compactSurfaceHint')");
	});
});
