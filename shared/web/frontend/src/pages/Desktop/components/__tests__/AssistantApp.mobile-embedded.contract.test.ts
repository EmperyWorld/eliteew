/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for `#/mobile-handbook` embedded layout (wide WebView, flex viewport).
 *
 * Invariants:
 * - Layout branches use embeddedMobileLayout, not Tailwind md/lg alone.
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - components/mobileEmbedded/mobileEmbeddedTheme.css
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readComponentSource(relativePath: string): string {
	const dir = dirname(fileURLToPath(import.meta.url));
	return readFileSync(join(dir, relativePath), 'utf8');
}

describe('AssistantApp mobile handbook embedded contract', () => {
	it('uses embeddedMobileLayout for flex column and handbook tokens', () => {
		const appSrc = readComponentSource('../AssistantApp.tsx');
		const layoutHookSrc = readComponentSource(
			'../assistant/useAssistantResponsiveFaqLayout.ts'
		);
		const pageSrc = readFileSync(
			join(
				dirname(fileURLToPath(import.meta.url)),
				'../../../MobileHandbook/MobileHandbookPage.tsx'
			),
			'utf8'
		);
		const themeSrc = readFileSync(
			join(
				dirname(fileURLToPath(import.meta.url)),
				'../../../../components/mobileEmbedded/mobileEmbeddedTheme.css'
			),
			'utf8'
		);

		expect(appSrc).toContain('embeddedMobileLayout');
		expect(appSrc).toContain('DesktopProductWorkspace');
		expect(appSrc).toContain('data-testid="assistant-product-workspace"');
		expect(appSrc).toContain('MOBILE_EMBEDDED_HANDBOOK_ROOT_CLASS');
		expect(appSrc).toContain('MOBILE_EMBEDDED_HANDBOOK_CHAT_COLUMN_CLASS');
		expect(appSrc).toContain(
			"data-assistant-guide-root={embeddedMobileLayout ? '1' : undefined}"
		);
		expect(appSrc).toContain("!embeddedMobileLayout && 'md:flex-row'");
		expect(appSrc).toContain('faqMobileOpen');
		expect(layoutHookSrc).toContain('readInitialAssistantFaqOpen');
		expect(layoutHookSrc).toContain('persistAssistantFaqOpen');
		expect(layoutHookSrc).toContain('ASSISTANT_COMPACT_SPLIT_WIDTH_PX');

		expect(pageSrc).toContain('MobileEmbeddedShell');
		expect(pageSrc).toContain('<AssistantApp embeddedMobile />');

		expect(themeSrc).toContain("data-assistant-guide-root='1'");
		expect(themeSrc).toContain('mobile-handbook-faq-collapsed');
		expect(themeSrc).toContain('faq-collapsed-chip');
	});

	it('keeps FAQ chip and panel toggle visible on embedded wide WebView', () => {
		const threadSrc = readComponentSource(
			'../assistant/AssistantChatThreadPanel.tsx'
		);
		const faqSrc = readComponentSource('../assistant/AssistantFaqPanel.tsx');
		const composerSrc = readComponentSource(
			'../assistant/AssistantComposerCluster.tsx'
		);

		expect(threadSrc).toContain('MOBILE_EMBEDDED_HANDBOOK_FAQ_CHIP_CLASS');
		expect(threadSrc).toContain('data-assistant-guide="faq-collapsed-chip"');
		expect(threadSrc).toContain('data-assistant-guide="local-faq-chip"');
		expect(threadSrc).not.toContain('ASSISTANT_FAQ_COLLAPSED_HINT_CLASS');

		expect(faqSrc).toContain('AssistantFaqModeExplainer');
		expect(faqSrc).toContain('AssistantFaqCard');
		expect(faqSrc).toContain('data-assistant-guide="faq-panel-toggle"');
		expect(faqSrc).toContain('mobile-handbook-faq-open');
		expect(faqSrc).toContain("embeddedMobileLayout && 'md:inline-flex'");

		expect(composerSrc).toContain(
			'MOBILE_EMBEDDED_HANDBOOK_COMPOSER_SEND_CLASS'
		);
		expect(composerSrc).toContain('rateLimitBannerFocusFaq');
		expect(composerSrc).toContain('onFocusFaqSearch');
		expect(composerSrc).toContain('streamStoppedHint');
	});

	it('gates bubble breakpoints and keyboard shortcuts for embedded layout', () => {
		const appSrc = readComponentSource('../AssistantApp.tsx');
		const bubbleSrc = readComponentSource(
			'../assistant/AssistantChatMessageBubble.tsx'
		);
		const listSrc = readComponentSource(
			'../assistant/AssistantChatMessageList.tsx'
		);
		const shortcutsSrc = readComponentSource(
			'../assistant/useAssistantKeyboardShortcuts.ts'
		);

		expect(appSrc).toContain('embeddedMobileLayout,');
		expect(appSrc).toContain('!embeddedMobileLayout ? (');
		expect(appSrc).toContain('<AssistantGuideTour');

		expect(bubbleSrc).toContain('embeddedMobileLayout?: boolean');
		expect(bubbleSrc).toContain(
			"embeddedMobileLayout ? 'px-2' : 'max-sm:px-2'"
		);
		expect(bubbleSrc).toContain('!embeddedMobileLayout ? (');
		expect(bubbleSrc).toContain(
			"embeddedMobileLayout ? 'px-2' : 'max-md:px-2'"
		);

		expect(listSrc).toContain('embeddedMobileLayout={embeddedMobileLayout}');

		expect(shortcutsSrc).toContain('embeddedMobileLayout?: boolean');
		expect(shortcutsSrc).toContain(
			'if (embeddedMobileLayout || faqCount === 0) return'
		);
		expect(shortcutsSrc).toContain('if (embeddedMobileLayout) return');
	});

	it('shows local FAQ chip row on embedded handbook chat column', () => {
		const threadSrc = readComponentSource(
			'../assistant/AssistantChatThreadPanel.tsx'
		);

		expect(threadSrc).toContain(
			'embeddedMobileLayout && localFaqMessagesCount > 0'
		);
		expect(threadSrc).toContain('data-assistant-guide="local-faq-chip"');
		expect(threadSrc).toContain("t('faqCollapsedChipLabel'");
		expect(threadSrc).toContain("aria-label={t('faqCollapsedTapHint'");
	});

	it('hides desktop Feedback Hub empty footer on embedded handbook', () => {
		const listSrc = readComponentSource(
			'../assistant/AssistantChatMessageList.tsx'
		);
		expect(listSrc).toContain('{!embeddedMobileLayout ? (');
		expect(listSrc).toContain('ASSISTANT_EMPTY_FEEDBACK_FOOTER_CLASS');
		expect(listSrc).toContain('FeedbackHubApp');
	});

	it('skips guide tour mount and document shortcuts on embedded handbook', () => {
		const appSrc = readComponentSource('../AssistantApp.tsx');
		const shortcutsSrc = readComponentSource(
			'../assistant/useAssistantKeyboardShortcuts.ts'
		);

		expect(appSrc).toContain('useAssistantKeyboardShortcuts({');
		expect(appSrc).toMatch(
			/\{!embeddedMobileLayout \?\s*\(\s*\n\s*<AssistantGuideTour/
		);
		expect(appSrc).toMatch(/<AssistantGuideTour[\s\S]*?\)\s*:\s*null\}/);

		expect(shortcutsSrc).toContain("if (e.key !== '/'");
		expect(shortcutsSrc).toContain("if (e.key !== '.'");
	});
});
