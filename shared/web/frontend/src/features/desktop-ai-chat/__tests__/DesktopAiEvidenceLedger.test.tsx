/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify the user-visible evidence ledger, derived-source warning, safe links, and empty trust state.
 *
 * Invariants:
 * - The ledger never presents a derived AI artifact as independent evidence.
 *
 * Related:
 * - src/features/desktop-ai-chat/components/DesktopAiEvidenceLedger.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DesktopAiEvidenceLedger } from '../components/DesktopAiEvidenceLedger';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) =>
			options?.count === undefined ? key : `${key}:${options.count}`,
	}),
}));

describe('DesktopAiEvidenceLedger', () => {
	it('shows independent and derived evidence with separate honest states', () => {
		render(
			<DesktopAiEvidenceLedger
				sources={[
					{
						citation_id: 'P1',
						kind: 'project_document',
						authority: 'project_material',
						title: 'Project research',
					},
					{
						citation_id: 'D1',
						kind: 'derived_ai_artifact',
						authority: 'derived',
						title: 'Earlier AI brief',
					},
					{
						citation_id: 'W1',
						kind: 'web',
						authority: 'external',
						title: 'External report',
						url: 'https://example.com/report',
					},
				]}
				qualityStatus={{
					status: 'repaired',
					grounding_status: 'derived_context',
					repair_attempted: true,
					repair_applied: true,
				}}
			/>
		);

		expect(
			screen.getByRole('region', { name: 'evidenceLedgerAria' })
		).toBeTruthy();
		expect(screen.getByText('qualityFinalization.repaired.title')).toBeTruthy();
		expect(
			screen.getByText('qualityGrounding.derived_context.title')
		).toBeTruthy();
		expect(screen.getByText('【P1】')).toBeTruthy();
		expect(screen.getByText('【D1】')).toBeTruthy();
		expect(screen.getByText('evidenceLedgerMaterialsSummary:3')).toBeTruthy();
		expect(
			screen.getByRole('link', { name: /External report/ })
		).toHaveAttribute('href', 'https://example.com/report');
		expect(screen.getByTitle(/evidenceAuthority.derived/)).toBeTruthy();
	});

	it('keeps the materials list collapsed by default for progressive disclosure', () => {
		const { container } = render(
			<DesktopAiEvidenceLedger
				sources={[
					{
						citation_id: 'P1',
						kind: 'project_document',
						authority: 'project_material',
						title: 'Project research',
					},
				]}
			/>
		);
		const details = container.querySelector('details');
		expect(details).toBeTruthy();
		expect(details?.open).toBe(false);
	});

	it('renders an explicit hypothesis state when no evidence is available', () => {
		render(<DesktopAiEvidenceLedger sources={[]} />);

		expect(
			screen.getByText('qualityGrounding.hypothesis_only.title')
		).toBeTruthy();
		expect(screen.getByRole('note')).toBeTruthy();
		expect(screen.getByText('evidenceLedgerEmptyTitle')).toBeTruthy();
	});
});
