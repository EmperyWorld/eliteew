/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Feedback Hub UX implementation (plan 10/20): mobile order,
 * stats skeleton, filter reset, a11y focus target, compose sticky bar.
 *
 * Invariants:
 * - Source-level contracts; no full render harness required.
 *
 * Related:
 * - FeedbackHubApp.tsx · feedbackHub/* · FEEDBACK-HUB.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readComponentSource(relativePath: string): string {
	const dir = dirname(fileURLToPath(import.meta.url));
	return readFileSync(join(dir, relativePath), 'utf8');
}

describe('feedbackHub UX implementation contracts', () => {
	it('FeedbackHubApp shows stats skeleton and mobile compose-first order', () => {
		const src = readComponentSource('../../FeedbackHubApp.tsx');
		expect(src).toContain('FeedbackHubStatsSkeleton');
		expect(src).toContain("embeddedMobileLayout && 'order-1'");
		expect(src).toContain("embeddedMobileLayout && 'order-2'");
		expect(src).toMatch(/feedback-ticket-article-\$\{created\.id\}/);
		expect(src).toContain('ticket.id');
	});

	it('FeedbackHubTicketListSection exposes mobile filter reset', () => {
		const src = readComponentSource('../FeedbackHubTicketListSection.tsx');
		expect(src).toContain('filtersActiveMobileHint');
		expect(src).toContain('embeddedMobileLayout ?');
		expect(src).toContain('onResetListFilters');
	});

	it('FeedbackHubComposeForm supports embedded sticky send bar', () => {
		const src = readComponentSource('../FeedbackHubComposeForm.tsx');
		expect(src).toContain('embeddedMobileLayout');
		expect(src).toContain('sticky bottom-0');
		expect(src).toContain('BookOpenIcon');
		expect(src).toContain('variant="neutral"');
	});

	it('FeedbackHubTicketCard focuses article landmark after create', () => {
		const src = readComponentSource('../FeedbackHubTicketCard.tsx');
		expect(src).toMatch(/feedback-ticket-article-\$\{ticket\.id\}/);
		expect(src).toContain(
			'tabIndex={highlightedId === ticket.id ? -1 : undefined}'
		);
		expect(src).toContain('ticketIdShort');
	});

	it('FeedbackHubAppHeader explains trusted limits without duplicate app title', () => {
		const src = readComponentSource('../FeedbackHubAppHeader.tsx');
		expect(src).toContain('trustedBadgeHint');
		expect(src).toContain('DesktopChromeTooltip');
		expect(src).toContain("title={t('trustedBadgeHint'");
		expect(src).toContain("t('tagline')");
		expect(src).not.toContain("DESKTOP_TYPOGRAPHY.subtitle}>{t('title')}");
		expect(src).not.toContain('<h2 className={DESKTOP_TYPOGRAPHY.subtitle}');
	});

	it('FeedbackHubStatsSkeleton matches stats grid layout', () => {
		const src = readComponentSource('../FeedbackHubStatsSkeleton.tsx');
		expect(src).toContain("!embeddedMobileLayout && 'sm:grid-cols-3'");
		expect(src).toContain('motion-reduce:animate-none');
	});
});
