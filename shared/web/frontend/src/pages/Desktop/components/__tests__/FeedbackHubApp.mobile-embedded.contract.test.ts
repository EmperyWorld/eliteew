import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readComponentSource(relativePath: string): string {
	const dir = dirname(fileURLToPath(import.meta.url));
	return readFileSync(join(dir, relativePath), 'utf8');
}

describe('FeedbackHubApp mobile embedded contract', () => {
	it('keeps single-column layout and hides desktop-only chrome', () => {
		const appSrc = readComponentSource('../FeedbackHubApp.tsx');

		expect(appSrc).toContain('embeddedMobileLayout');
		expect(appSrc).toContain('DesktopProductWorkspace');
		expect(appSrc).toContain('data-testid="feedback-hub-product-workspace"');
		expect(appSrc).toContain("!embeddedMobileLayout && 'xl:grid-cols-2");
		expect(appSrc).toContain('FeedbackHubAppHeader');
		expect(appSrc).toContain('shouldRenderFullShellOnlyChrome');
		expect(appSrc).toContain('useFeedbackHubLayoutClasses');

		const headerSrc = readComponentSource(
			'../feedbackHub/FeedbackHubAppHeader.tsx'
		);
		expect(headerSrc).toContain('data-feedback-hub-guide="header"');
		expect(headerSrc).toContain('desktopFullShellOnlyChromeProps');
		expect(headerSrc).toContain('data-desktop-chrome');
		expect(appSrc).toContain('enabled: !embeddedMobileLayout');
		expect(appSrc).toContain('FeedbackHubStatsSection');
		expect(appSrc).toContain('FeedbackHubStatsSkeleton');
		expect(appSrc).toContain("embeddedMobileLayout && 'order-1'");
		expect(appSrc).toContain('FeedbackHubComposeForm');
	});

	it('keeps compose guide anchors and a11y field ids in extracted modules', () => {
		const composeSrc = readComponentSource(
			'../feedbackHub/FeedbackHubComposeForm.tsx'
		);
		const stylesSrc = readComponentSource(
			'../feedbackHub/feedbackHubComposeStyles.ts'
		);
		const statsSrc = readComponentSource(
			'../feedbackHub/FeedbackHubStatsSection.tsx'
		);

		expect(composeSrc).toContain('data-feedback-hub-guide="compose-kind"');
		expect(composeSrc).toContain('data-feedback-hub-guide="compose-form"');
		expect(composeSrc).toContain('FeedbackHubComposePreview');
		expect(composeSrc).toContain('mapFeedbackSubmitError');
		expect(composeSrc).toContain('embeddedMobileLayout');
		expect(composeSrc).toContain('sticky bottom-0');
		expect(composeSrc).toContain('data-feedback-hub-guide="send-bar"');
		expect(composeSrc).toContain('FEEDBACK_HUB_MAIN_MESSAGE_FIELD_ID');
		expect(composeSrc).toContain(
			'aria-describedby={FEEDBACK_HUB_MAIN_MESSAGE_HINT_ID}'
		);
		expect(stylesSrc).toContain("'feedback-hub-main'");

		const previewSrc = readComponentSource(
			'../feedbackHub/FeedbackHubComposePreview.tsx'
		);
		expect(previewSrc).toContain('data-feedback-hub-guide="preview"');
		expect(previewSrc).toContain('FEEDBACK_HUB_PREVIEW_FIELD_ID');

		const listSrc = readComponentSource(
			'../feedbackHub/FeedbackHubTicketListSection.tsx'
		);
		expect(listSrc).toContain('FeedbackHubTicketCard');

		expect(statsSrc).toContain('data-feedback-hub-guide="stats"');
		expect(statsSrc).toContain("!embeddedMobileLayout && 'sm:grid-cols-3'");
	});
});
