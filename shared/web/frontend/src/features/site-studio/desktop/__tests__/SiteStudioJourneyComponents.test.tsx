/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Rendering coverage for Site Studio journey checklist and guided cockpit CTAs.
 *
 * Invariants:
 * - Checklist cards expose current and blocked states as user-visible copy.
 * - Cockpit primary CTA delegates action handling to the parent workspace.
 *
 * Related:
 * - ../components/SiteStudioChecklist.tsx
 * - ../components/SiteStudioGuidedCockpit.tsx
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SiteStudioChecklist } from '../components/SiteStudioChecklist';
import { SiteStudioGuidedCockpit } from '../components/SiteStudioGuidedCockpit';
import { SiteStudioHeader } from '../components/SiteStudioHeader';
import type { SiteStudioHealth, SiteStudioInstance } from '../api';
import type { SiteStudioJourneyModel } from '../siteStudioUserJourney';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) =>
			({
				'checklist.title': 'Setup checklist',
				'checklist.intro': 'Follow the guided path.',
				'header.productLabel': 'Site Studio',
				'header.topicFallback': 'Build a site.',
				'header.refreshAria': 'Refresh status',
				'header.navAria': 'Site Studio sections',
				'header.runtimeBadge': `Launch: ${params?.status}`,
				'header.siteBadge': `Site: ${params?.state}`,
				'header.apiBadge': `Admin: ${params?.state}`,
				'header.publicBadge': `Storefront: ${params?.state}`,
				'header.routeBadge': `Route: ${params?.done}/${params?.total}`,
				'header.nextBadge': `Next: ${params?.stage}`,
				'header.siteClosed': 'closed',
				'header.stateOffline': 'offline',
				'journey.cockpitLabel': 'Launch route',
				'journey.progressAria': 'Site Studio launch progress',
				'journey.progressSummary': `${params?.done}/${params?.total} steps ready`,
				'journey.applySummary': `applied ${params?.applied}, needs review ${params?.skipped}, failed ${params?.failed}`,
				'journey.applyReview.warningTitle': 'Review partially applied drafts',
				'journey.applyReview.failedTitle': 'Some drafts failed to apply',
				'journey.applyReview.description': `Applied: ${params?.applied}. Needs review: ${params?.skipped}. Failed: ${params?.failed}. Open drafts and check the uncertain blocks before launch.`,
				'journey.timelineTitle': 'Launch map',
				'journey.timelineDescription': 'Each step shows the next action.',
				'journey.timelineStepNumber': `Step ${params?.index} of ${params?.total}`,
				'journey.timelineStepAria': `Step ${params?.index} of ${params?.total}: ${params?.title}, status: ${params?.status}`,
				'journey.stage.review.title': 'Review and apply drafts',
				'journey.stage.review.description': 'Check drafts before launch.',
				'journey.status.done': 'done',
				'journey.status.current': 'current',
				'journey.status.blocked': 'needs attention',
				'journey.status.next': 'next',
				'journey.steps.setup.title': 'Idea',
				'journey.steps.setup.description': 'Brief saved.',
				'journey.steps.aiFill.title': 'AI fill',
				'journey.steps.aiFill.description': 'Blueprint ready.',
				'journey.steps.review.title': 'Review',
				'journey.steps.review.description': 'Review drafts.',
				'journey.steps.media.title': 'Visuals',
				'journey.steps.media.description': 'Visuals ready.',
				'journey.actions.applyDrafts': 'Apply drafts',
				'journey.actions.reviewDrafts': 'Review drafts',
			})[key] ?? key,
		i18n: { language: 'en' },
	}),
}));

const journey: SiteStudioJourneyModel = {
	stage: 'review',
	titleKey: 'journey.stage.review.title',
	descriptionKey: 'journey.stage.review.description',
	blockerKey: null,
	primaryAction: {
		kind: 'apply_all',
		labelKey: 'journey.actions.applyDrafts',
	},
	secondaryActions: [
		{
			kind: 'tab',
			labelKey: 'journey.actions.reviewDrafts',
			tab: 'content',
		},
	],
	steps: [
		{
			id: 'setup',
			titleKey: 'journey.steps.setup.title',
			descriptionKey: 'journey.steps.setup.description',
			status: 'done',
		},
		{
			id: 'ai_fill',
			titleKey: 'journey.steps.aiFill.title',
			descriptionKey: 'journey.steps.aiFill.description',
			status: 'done',
		},
		{
			id: 'review',
			titleKey: 'journey.steps.review.title',
			descriptionKey: 'journey.steps.review.description',
			status: 'current',
			action: {
				kind: 'apply_all',
				labelKey: 'journey.actions.applyDrafts',
			},
		},
		{
			id: 'media',
			titleKey: 'journey.steps.media.title',
			descriptionKey: 'journey.steps.media.description',
			status: 'blocked',
			action: {
				kind: 'tab',
				labelKey: 'journey.actions.reviewDrafts',
				tab: 'media',
			},
		},
	],
	progressDone: 2,
	progressTotal: 4,
	applySummary: {
		applied: 4,
		skipped: 1,
		failed: 0,
		needsReview: true,
	},
};

const instance: SiteStudioInstance = {
	id: 'site-1',
	user_id: 'user-1',
	template_key: 'default',
	site_slug: 'demo',
	site_title: 'Demo Site',
	site_topic: 'Bakery',
	brief_json: {},
	status: 'stopped',
	public_hostname: 'demo.sites.eliteew.ru',
	publication_state: 'closed',
	public_url: null,
	api_base_url: null,
	opened_at: null,
	closed_at: null,
	admin_email: null,
	runtime_dir: null,
	source_dir: null,
	env_dir: null,
	compose_file_path: '/runtime/docker-compose.yml',
	compose_project_name: null,
	ports_json: {},
	db_name: null,
	last_error: null,
	last_provisioned_at: null,
	created_at: '2026-05-29T00:00:00Z',
	updated_at: '2026-05-29T00:00:00Z',
};

const health: SiteStudioHealth = {
	status: 'stopped',
	api_ok: false,
	public_ok: false,
	api_error: null,
	public_error: null,
	ports: {},
	public_hostname: null,
	publication_state: 'closed',
	public_url: null,
	api_base_url: null,
	worker_ready: true,
	worker_id: 'worker-1',
	worker_last_seen_at: '2026-05-29T00:00:00Z',
	worker_last_seen_age_seconds: 1,
	worker_ready_window_seconds: 30,
	last_job: null,
	pending_job: null,
};

describe('Site Studio journey components', () => {
	it('renders actionable checklist states', () => {
		const onAction = vi.fn();

		render(<SiteStudioChecklist journey={journey} onAction={onAction} />);

		expect(screen.getByText('current')).toBeInTheDocument();
		expect(screen.getByText('needs attention')).toBeInTheDocument();
		fireEvent.click(screen.getAllByText('Apply drafts')[0]);
		expect(onAction).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'apply_all' })
		);
	});

	it('routes cockpit CTA through parent action handler', () => {
		const onAction = vi.fn();

		render(<SiteStudioGuidedCockpit journey={journey} onAction={onAction} />);

		expect(screen.getByText('Review and apply drafts')).toBeInTheDocument();
		expect(screen.getByText('2/4 steps ready')).toBeInTheDocument();
		expect(screen.queryByText('Launch map')).not.toBeInTheDocument();
		fireEvent.click(screen.getAllByText('Apply drafts')[0]);
		expect(onAction).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'apply_all' })
		);
	});

	it('promotes partial apply results into a review banner', () => {
		const onAction = vi.fn();

		render(<SiteStudioGuidedCockpit journey={journey} onAction={onAction} />);

		const banner = screen
			.getByText('Review partially applied drafts')
			.closest('[role="status"]');
		expect(banner).not.toBeNull();
		expect(banner).toHaveTextContent('Review partially applied drafts');
		expect(banner).toHaveTextContent('Applied: 4. Needs review: 1. Failed: 0.');
		fireEvent.click(within(banner as HTMLElement).getByText('Apply drafts'));
		expect(onAction).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'apply_all' })
		);
	});

	it('surfaces journey progress in the sticky header status row', () => {
		render(
			<SiteStudioHeader
				instance={instance}
				health={health}
				activeTab="setup"
				toolTabs={[{ id: 'ai', label: 'Assistant' }]}
				journey={journey}
				onRefresh={vi.fn()}
				onSelectTab={vi.fn()}
				onSelectJourneyStep={vi.fn()}
			/>
		);

		expect(screen.getByText('Route: 2/4')).toBeInTheDocument();
		expect(
			screen.getByText('Next: Review and apply drafts')
		).toBeInTheDocument();
		expect(screen.getByTestId('site-studio-stage-nav')).toBeInTheDocument();
	});
});
