/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime smoke for SurveysAdminSection default catalog tab — catches missing
 * SurveyAdminCatalogPanel import (ReferenceError in UnifiedAdminPage chunk).
 *
 * Invariants:
 * - Default tab is catalog; panel must mount without throw.
 *
 * Related:
 * - pages/Admin/SurveysAdminSection.tsx
 * - pages/Admin/surveys/SurveyAdminCatalogPanel.tsx
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SurveysAdminSection } from '../SurveysAdminSection';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

vi.mock('../../Desktop/services/productDesktopSurveysApi', () => ({
	adminListSurveys: vi.fn(async () => ({ items: [] })),
	adminGetSurvey: vi.fn(),
	adminCreateSurvey: vi.fn(),
	adminPatchSurvey: vi.fn(),
	adminPublishSurvey: vi.fn(),
	adminArchiveSurvey: vi.fn(),
	adminReplaceSurveyQuestions: vi.fn(),
	adminReplaceSurveyAudience: vi.fn(),
	adminPreviewSurveyAudience: vi.fn(),
	adminQueueSurveyGafNotify: vi.fn(),
}));

vi.mock('../../Desktop/services/desktopAdminApi', () => ({
	getAccessGroups: vi.fn(async () => []),
	getUsers: vi.fn(async () => []),
}));

vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function renderSection(): void {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<SurveysAdminSection />
		</QueryClientProvider>
	);
}

describe('SurveysAdminSection catalog tab smoke', () => {
	it('imports and renders SurveyAdminCatalogPanel on default catalog tab', async () => {
		renderSection();
		expect(await screen.findByText('admin.catalogEmpty')).toBeTruthy();
		expect(screen.getByText('admin.catalogKpi.total')).toBeTruthy();
		expect(
			screen.getAllByRole('button', { name: 'admin.createSurvey' }).length
		).toBeGreaterThan(0);
	});
});
