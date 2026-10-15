import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('SocialHubShell mobile embedded contract', () => {
	it('forces embedded segment nav and single-column home grids', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const shellSrc = readFileSync(join(dir, '../SocialHubShell.tsx'), 'utf8');
		const homeSrc = readFileSync(
			join(dir, '../sections/SocialHubHomeSection.tsx'),
			'utf8'
		);
		const tokensSrc = readFileSync(
			join(dir, '../layout/socialHubLayoutTokens.ts'),
			'utf8'
		);

		expect(shellSrc).toContain('data-social-hub-root="1"');
		expect(shellSrc).toContain('enabled: !embeddedMobile');
		expect(homeSrc).toContain('shHomeKpiGridClass(embeddedMobile)');
		expect(homeSrc).toContain('shHomeOverviewColumnsClass(embeddedMobile)');
		expect(tokensSrc).toContain('!embeddedMobileLayout &&');
	});
});
