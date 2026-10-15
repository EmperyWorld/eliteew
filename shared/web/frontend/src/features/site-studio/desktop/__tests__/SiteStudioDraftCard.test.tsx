/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Rendering coverage for Site Studio draft cards with per-draft apply-result feedback.
 *
 * Invariants:
 * - Apply report text is user-visible and does not replace error rendering.
 * - Parent components still provide draft actions.
 *
 * Related:
 * - ../components/SiteStudioDraftCard.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SiteStudioDraftCard } from '../components/SiteStudioDraftCard';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				'draftCard.applyResult': 'Apply result',
				'draftCard.applyError': 'Could not apply',
				'draftCard.applying': 'Applying',
			})[key] ?? key,
		i18n: { language: 'en' },
	}),
}));

describe('SiteStudioDraftCard', () => {
	it('renders per-draft apply result feedback', () => {
		render(
			<SiteStudioDraftCard
				eyebrow="Content Draft"
				title="Hero Pack"
				applyResult="applied: 3 · skipped: 0 · failed: 0"
			>
				<div>Draft body</div>
			</SiteStudioDraftCard>
		);

		expect(screen.getByText('Apply result.')).toBeInTheDocument();
		expect(
			screen.getByText('applied: 3 · skipped: 0 · failed: 0')
		).toBeInTheDocument();
		expect(screen.getByText('Draft body')).toBeInTheDocument();
	});
});
