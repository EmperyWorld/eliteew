import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readComponentSource(relativePath: string): string {
	const dir = dirname(fileURLToPath(import.meta.url));
	return readFileSync(join(dir, relativePath), 'utf8');
}

describe('EwaDesktopApp mobile embedded contract', () => {
	it('uses embeddedMobile for FirstMeet and width tier, not md: alone', () => {
		const appSrc = readComponentSource('../EwaDesktopApp.tsx');
		const firstMeetSrc = readComponentSource('../EwaCompanionFirstMeet.tsx');
		const tokensSrc = readFileSync(
			join(
				dirname(fileURLToPath(import.meta.url)),
				'../../../components/mobileEmbedded/mobileEmbeddedLayoutTokens.ts'
			),
			'utf8'
		);

		expect(appSrc).toContain('embeddedMobile={embeddedMobile}');
		expect(appSrc).toContain('useMobileEmbeddedHostViewport');
		expect(appSrc).toContain('data-me-width-tier');
		expect(firstMeetSrc).toContain('embeddedMobile');
		expect(firstMeetSrc).toContain(
			'MOBILE_EMBEDDED_EWA_FIRST_MEET_CHOICE_GRID_CLASS'
		);
		expect(firstMeetSrc).toContain('data-ewa-first-meet="1"');
		expect(firstMeetSrc).toContain('md:grid-cols-3');
		expect(tokensSrc).toContain(
			'MOBILE_EMBEDDED_EWA_FIRST_MEET_CHOICE_GRID_CLASS'
		);
		expect(tokensSrc).toContain('grid-cols-1');
	});

	it('maps axios 401/403 profile fetch to auth_error gate', () => {
		const appSrc = readComponentSource('../EwaDesktopApp.tsx');
		expect(appSrc).toMatch(/st === 401 \|\| st === 403[\s\S]*auth_error/);
	});

	it('passes embeddedMobile into empty transcript gateway', () => {
		const bundleSrc = readFileSync(
			join(
				dirname(fileURLToPath(import.meta.url)),
				'../companionUx/useCompanionChatTranscriptBundle.tsx'
			),
			'utf8'
		);
		const emptySrc = readComponentSource(
			'../companionUx/CompanionTranscriptEmptyState.tsx'
		);
		expect(bundleSrc).toContain('embeddedMobile: mobileEmbeddedLayout');
		expect(emptySrc).toContain('embeddedMobile={embeddedMobile}');
	});
});
