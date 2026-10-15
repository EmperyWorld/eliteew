/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Rendering coverage for Site Manager user UX cards, filters, repair actions, and domain stepper copy.
 *
 * Invariants:
 * - The panel keeps operator data available while surfacing user-facing next actions first.
 * - Smoke checks and reconcile repairs are launched through the existing Site Manager Ops API client.
 *
 * Related:
 * - ../components/SiteManagerOpsPanel.tsx
 * - ../siteManagerUserStatus.ts
 */
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SiteManagerOpsPanel } from '../components/SiteManagerOpsPanel';
import {
	cancelSiteManagerLifecycleJob,
	getSiteManagerOpsInstances,
	getSiteManagerOpsOverview,
	getSiteManagerOpsTemplates,
	markSiteManagerDnsOutboxApplied,
	markSiteManagerReconcileFailed,
	retrySiteManagerLifecycleJob,
	runSiteManagerPublishSmoke,
	type SiteManagerOpsOverview,
	type SiteStudioLifecycleJob,
} from '../api';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) => {
			if (params?.count != null) return `${key} ${params.count}`;
			if (params?.time != null) return `${key} ${params.time}`;
			if (params?.target != null) return `${key} ${params.target}`;
			return key;
		},
	}),
}));

vi.mock('../api', () => ({
	cancelSiteManagerLifecycleJob: vi.fn(),
	getSiteManagerOpsInstances: vi.fn(),
	getSiteManagerOpsOverview: vi.fn(),
	getSiteManagerOpsTemplates: vi.fn(),
	markSiteManagerDnsOutboxApplied: vi.fn(),
	markSiteManagerDomainTlsReady: vi.fn(),
	markSiteManagerReconcileFailed: vi.fn(),
	retrySiteManagerLifecycleJob: vi.fn(),
	runSiteManagerPublishSmoke: vi.fn(),
}));

const mockedCancelJob = vi.mocked(cancelSiteManagerLifecycleJob);
const mockedInstances = vi.mocked(getSiteManagerOpsInstances);
const mockedOverview = vi.mocked(getSiteManagerOpsOverview);
const mockedTemplates = vi.mocked(getSiteManagerOpsTemplates);
const mockedSmoke = vi.mocked(runSiteManagerPublishSmoke);
const mockedMarkOutbox = vi.mocked(markSiteManagerDnsOutboxApplied);
const mockedMarkReconcileFailed = vi.mocked(markSiteManagerReconcileFailed);
const mockedRetryJob = vi.mocked(retrySiteManagerLifecycleJob);

const siteManagerOverview = (): SiteManagerOpsOverview => ({
	worker: {
		worker_ready: true,
		worker_id: 'worker-1',
		worker_last_seen_at: '2026-05-29T00:00:00Z',
		worker_last_seen_age_seconds: 1,
		worker_ready_window_seconds: 180,
	},
	instances: [
		{
			instance_scope: 'user' as const,
			id: 'ready-site',
			site_slug: 'ready',
			site_title: 'Ready Site',
			status: 'running',
			publication_state: 'closed',
			public_hostname: 'ready.sites.eliteew.ru',
			public_url: null,
			api_base_url: null,
			compose_project_name: 'ready',
			runtime_dir: '/runtime/ready',
			source_dir: null,
			env_dir: null,
			compose_file_path: '/runtime/ready/docker-compose.yml',
			updated_at: '2026-05-29T00:00:00Z',
			last_error: null,
			marketing_project_id: null,
			client_access_json: {},
		},
		{
			instance_scope: 'user' as const,
			id: 'domain-site',
			site_slug: 'domain',
			site_title: 'Domain Site',
			status: 'running',
			publication_state: 'closed',
			public_hostname: 'domain.sites.eliteew.ru',
			public_url: null,
			api_base_url: null,
			compose_project_name: 'domain',
			runtime_dir: '/runtime/domain',
			source_dir: null,
			env_dir: null,
			compose_file_path: '/runtime/domain/docker-compose.yml',
			updated_at: '2026-05-29T00:00:00Z',
			last_error: null,
			marketing_project_id: null,
			client_access_json: {},
		},
	],
	jobs: [
		{
			id: 'job-ready',
			instance_scope: 'user' as const,
			instance_id: 'ready-site',
			site_slug: 'ready',
			task_type: 'publish',
			status: 'finished',
			stage: 'smoke',
			queued: false,
			worker_id: 'worker-1',
			attempts: 1,
			last_error: null,
			metadata_json: {},
			created_at: '2026-05-29T00:00:00Z',
			queued_at: null,
			started_at: '2026-05-29T00:00:10Z',
			finished_at: '2026-05-29T00:01:00Z',
			updated_at: '2026-05-29T00:01:00Z',
			duration_ms: 50000,
		},
	],
	domains: [
		{
			id: 'domain-binding',
			instance_scope: 'user' as const,
			instance_id: 'domain-site',
			hostname: 'domain.example.test',
			status: 'verified',
			verification_method: 'txt',
			verification_name: '_eliteew-site.domain.example.test',
			verification_token_preview: 'token',
			expected_cname: null,
			verified_at: '2026-05-29T00:00:00Z',
			last_checked_at: null,
			route_ready_at: null,
			tls_status: 'pending',
			last_error: null,
			metadata_json: {},
			created_at: '2026-05-29T00:00:00Z',
			updated_at: '2026-05-29T00:00:00Z',
		},
	],
	dns_outbox: [
		{
			id: 'outbox-1',
			binding_id: 'domain-binding',
			hostname: 'domain.example.test',
			target_hostname: 'domain.sites.eliteew.ru',
			status: 'pending',
			requested_at: '2026-05-29T00:00:00Z',
			applied_at: null,
			last_error: null,
			metadata_json: {},
		},
	],
	reconcile: {
		count: 0,
		entries: [],
		generated_at: '2026-05-29T00:00:00Z',
	},
	audit_events: [
		{
			id: 'audit-ready',
			actor_user_id: 'operator',
			action: 'publish_smoke',
			target_type: 'site',
			target_id: 'ready-site',
			before_json: null,
			after_json: null,
			result_json: null,
			metadata_json: {},
			created_at: '2026-05-29T00:02:00Z',
		},
	],
	overview_limits: {},
	generated_at: '2026-05-29T00:00:00Z',
});

beforeEach(() => {
	vi.clearAllMocks();
	window.sessionStorage.clear();
});

function openSiteManagerView(mode: 'attention' | 'domains' | 'advanced') {
	fireEvent.click(screen.getByTestId(`site-manager-view-${mode}`));
}

describe('SiteManagerOpsPanel', () => {
	it('defaults to Attention view with attention-filtered site cards and scroll root', async () => {
		mockedOverview.mockResolvedValue(siteManagerOverview());
		mockedTemplates.mockResolvedValue({
			runtime_mode: 'images',
			templates: [],
		});

		render(<SiteManagerOpsPanel />);
		await screen.findByText('Domain Site');

		expect(screen.getByTestId('site-manager-view-attention')).toHaveAttribute(
			'aria-selected',
			'true'
		);
		expect(
			screen.queryByTestId('site-manager-card-user:ready-site')
		).not.toBeInTheDocument();
		expect(
			screen.getByTestId('site-manager-card-user:domain-site')
		).toBeInTheDocument();
		expect(
			screen.getByTestId('site-manager-dns-tls-queue')
		).toBeInTheDocument();
		expect(screen.getByText('siteManager.metrics.worker')).toBeInTheDocument();
		expect(
			screen.queryByLabelText('siteManager.siteCards.searchLabel')
		).not.toBeInTheDocument();

		const root = screen.getByTestId('site-manager-ops-root');
		expect(root.className).toMatch(/space-y-4/);
		expect(root.className).toMatch(/overflow-y-auto/);
		expect(root.className).not.toMatch(/\bflex-col\b/);
	});

	it('shows last updated meta after a successful refresh', async () => {
		mockedOverview.mockResolvedValue(siteManagerOverview());
		mockedTemplates.mockResolvedValue({
			runtime_mode: 'images',
			templates: [],
		});

		render(<SiteManagerOpsPanel />);
		await screen.findByTestId('site-manager-last-updated');
		expect(screen.getByTestId('site-manager-last-updated')).toHaveTextContent(
			'siteManager.lastUpdated'
		);
	});

	it('persists view mode in session controls storage', async () => {
		mockedOverview.mockResolvedValue(siteManagerOverview());
		mockedTemplates.mockResolvedValue({
			runtime_mode: 'images',
			templates: [],
		});

		render(<SiteManagerOpsPanel />);
		await screen.findByText('Domain Site');
		openSiteManagerView('advanced');

		expect(
			window.sessionStorage.getItem('eliteew.siteManagerOps.controls.v1')
		).toContain('"viewMode":"advanced"');
	});

	it('renders overview load failures as an assertive product status banner with retry', async () => {
		mockedOverview
			.mockRejectedValueOnce(new Error('overview offline'))
			.mockResolvedValueOnce(siteManagerOverview());
		mockedTemplates.mockResolvedValue({
			runtime_mode: 'images',
			templates: [],
		});

		render(<SiteManagerOpsPanel />);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveAttribute('aria-live', 'assertive');
		expect(alert).toHaveTextContent('siteManager.errorTitle');
		expect(alert).toHaveTextContent('overview offline');

		fireEvent.click(screen.getAllByText('siteManager.refresh')[1]);

		expect(await screen.findByText('Domain Site')).toBeInTheDocument();
		expect(mockedOverview).toHaveBeenCalledTimes(2);
	});

	it('renders site cards, filters domain-pending sites and runs smoke CTA', async () => {
		const clipboardWrite = vi.fn().mockResolvedValue(undefined);
		const scrollIntoView = vi.fn();
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: clipboardWrite },
			configurable: true,
		});
		Element.prototype.scrollIntoView = scrollIntoView;
		mockedOverview.mockResolvedValue(siteManagerOverview());
		mockedTemplates.mockResolvedValue({
			runtime_mode: 'images',
			templates: [],
		});
		mockedSmoke.mockResolvedValue({
			instance_scope: 'user',
			instance_id: 'ready-site',
			status: 'passed',
			checks: [
				{
					key: 'storefront_http',
					ok: true,
					severity: 'hard',
					message: 'Storefront responded',
				},
			],
			hard_failure_count: 0,
			generated_at: '2026-05-29T00:00:00Z',
		});
		mockedMarkOutbox.mockResolvedValue({
			id: 'outbox-1',
			binding_id: 'domain-binding',
			hostname: 'domain.example.test',
			target_hostname: 'domain.sites.eliteew.ru',
			status: 'applied',
			requested_at: '2026-05-29T00:00:00Z',
			applied_at: '2026-05-29T00:01:00Z',
			last_error: null,
			metadata_json: {},
		});

		render(<SiteManagerOpsPanel />);

		expect(await screen.findByText('Domain Site')).toBeInTheDocument();
		expect(
			screen.queryByTestId('site-manager-card-user:ready-site')
		).not.toBeInTheDocument();
		expect(
			await screen.findByText('siteManager.issueDigest.count 1')
		).toBeInTheDocument();

		openSiteManagerView('advanced');
		fireEvent.click(screen.getByText('siteManager.filters.all 2'));
		expect(await screen.findByText('Ready Site')).toBeInTheDocument();
		expect(screen.getAllByText('Domain Site').length).toBeGreaterThan(0);
		const searchInput = screen.getByLabelText(
			'siteManager.siteCards.searchLabel'
		);
		fireEvent.change(searchInput, { target: { value: 'domain' } });
		expect(
			screen.queryByTestId('site-manager-card-user:ready-site')
		).not.toBeInTheDocument();
		expect(
			screen.getByTestId('site-manager-card-user:domain-site')
		).toBeInTheDocument();
		expect(
			window.sessionStorage.getItem('eliteew.siteManagerOps.controls.v1')
		).toContain('"searchQuery":"domain"');
		fireEvent.change(searchInput, { target: { value: '' } });
		fireEvent.click(screen.getAllByText('siteManager.drilldown.open')[0]);
		expect(
			await screen.findByText('siteManager.issueDigest.count 0')
		).toBeInTheDocument();
		expect(
			await screen.findByText('siteManager.drilldown.title')
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.drilldown.summaryTitle')
		).toBeInTheDocument();
		expect(
			screen.getAllByText('siteManager.drilldown.sectionCount 1').length
		).toBeGreaterThan(0);
		expect(
			screen.getByText('siteManager.siteCards.selectedContext')
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.siteCards.jumpToDetails')
		).toBeInTheDocument();
		expect(
			screen.getAllByText('siteManager.siteCards.selectedSignals 0').length
		).toBeGreaterThanOrEqual(2);
		expect(
			screen.getByText('siteManager.siteCards.selectedSignals 1')
		).toBeInTheDocument();
		expect(
			screen.getAllByText('siteManager.siteCards.nextActionLabel').length
		).toBe(2);
		expect(screen.getAllByText('siteManager.siteCards.metaScope:').length).toBe(
			2
		);
		expect(screen.getAllByText('siteManager.siteCards.metaSlug:').length).toBe(
			2
		);
		expect(
			screen.getAllByText('siteManager.siteCards.metaStatus:').length
		).toBe(2);
		expect(
			screen.getByText('siteManager.siteCards.topSignal')
		).toBeInTheDocument();
		expect(
			screen.getAllByText('siteManager.publicationState.closed').length
		).toBeGreaterThan(0);
		expect(screen.getAllByText('siteManager.card.updated').length).toBe(2);
		expect(
			screen.getAllByText('siteManager.issueDigest.domainOperator').length
		).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText(/domain.example.test/).length).toBeGreaterThan(
			0
		);
		expect(
			screen.getByText('siteManager.issueDigest.title')
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.issueDigest.count 0')
		).toBeInTheDocument();
		expect(
			(
				await screen.findAllByText(
					/siteManager\.jobType\.publish · siteManager\.jobStatus\.finished/
				)
			).length
		).toBeGreaterThan(0);
		expect(
			screen.getByText('siteManager.drilldown.jobMetaStage:')
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.drilldown.jobMetaUpdated:')
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.drilldown.jobMetaAttempts:')
		).toBeInTheDocument();
		expect(
			screen.getAllByText('siteManager.auditAction.publish_smoke').length
		).toBeGreaterThan(0);
		expect(
			screen.getByText('siteManager.drilldown.auditTarget:')
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.drilldown.auditTime:')
		).toBeInTheDocument();
		fireEvent.click(screen.getByText('siteManager.drilldown.copySummary'));
		await waitFor(() => expect(clipboardWrite).toHaveBeenCalledTimes(1));
		expect(clipboardWrite).toHaveBeenCalledWith(
			expect.stringContaining('Ready Site')
		);
		expect(clipboardWrite).toHaveBeenCalledWith(
			expect.stringContaining('job-ready: publish/finished')
		);
		expect(
			await screen.findByText('siteManager.drilldown.copySummaryDone')
		).toBeInTheDocument();

		openSiteManagerView('domains');
		expect(
			screen.getByText('siteManager.domainStatus.routePending')
		).toBeInTheDocument();
		fireEvent.click(screen.getByText('siteManager.domains.markRouteApplied'));
		expect(mockedMarkOutbox).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByText('siteManager.domains.confirmRouteApplied')
		);
		await waitFor(() =>
			expect(mockedMarkOutbox).toHaveBeenCalledWith('outbox-1')
		);

		openSiteManagerView('advanced');
		fireEvent.click(screen.getByText('siteManager.filters.all 2'));
		const readyCard = screen.getByTestId('site-manager-card-user:ready-site');
		fireEvent.click(
			within(readyCard).getByText('siteManager.actions.runSmoke')
		);

		await waitFor(() => {
			expect(mockedSmoke).toHaveBeenCalledWith({
				instance_scope: 'user',
				instance_id: 'ready-site',
				run_live: true,
			});
		});
		expect(
			(await screen.findAllByText(/Storefront responded/)).length
		).toBeGreaterThan(0);
		await waitFor(() =>
			expect(
				screen.getByText(
					/siteManager\.drilldown\.smokeCheckKey: storefront_http/
				)
			).toBeInTheDocument()
		);
		fireEvent.click(
			within(
				screen.getByTestId('site-manager-card-user:domain-site')
			).getByText('siteManager.drilldown.open')
		);
		expect(screen.getAllByText('Domain Site').length).toBeGreaterThan(0);
		expect(screen.getAllByText('domain.example.test').length).toBeGreaterThan(
			0
		);
		const drilldownDomainSteps = screen.getByTestId(
			'site-manager-drilldown-domain-steps-domain-binding'
		);
		expect(
			within(drilldownDomainSteps).getByText('siteManager.domainSteps.verified')
		).toBeInTheDocument();
		expect(
			within(drilldownDomainSteps).getByText(
				'siteManager.domainStepStatus.current'
			)
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.issueDigest.count 1')
		).toBeInTheDocument();
		expect(
			screen.getAllByText('siteManager.siteCards.selectedSignals 1').length
		).toBeGreaterThanOrEqual(2);
		expect(
			screen.getAllByText('siteManager.issueDigest.domainOperator').length
		).toBeGreaterThanOrEqual(2);
		expect(
			screen.getByText('siteManager.drilldown.reconcile')
		).toBeInTheDocument();
		fireEvent.click(
			screen.getAllByText('siteManager.siteCards.selectedSignals 1')[0]
		);
		expect(scrollIntoView).toHaveBeenCalledWith({
			block: 'start',
			behavior: 'smooth',
		});
		fireEvent.click(screen.getByText('siteManager.drilldown.copyDigest'));
		await waitFor(() => expect(clipboardWrite).toHaveBeenCalledTimes(2));
		expect(clipboardWrite).toHaveBeenLastCalledWith(
			expect.stringContaining('siteManager.supportExport.signals: 1')
		);
		expect(clipboardWrite).toHaveBeenLastCalledWith(
			expect.stringContaining('domain.example.test')
		);
		expect(
			await screen.findByText('siteManager.drilldown.copyDigestDone')
		).toBeInTheDocument();
		fireEvent.click(screen.getByText('siteManager.siteCards.jumpToDetails'));
		expect(scrollIntoView).toHaveBeenCalledWith({
			block: 'start',
			behavior: 'smooth',
		});
		fireEvent.click(
			screen.getAllByText('siteManager.issueDigest.domainOperator')[0]
		);
		expect(scrollIntoView).toHaveBeenCalledWith({
			block: 'start',
			behavior: 'smooth',
		});
	});

	it('selects a site and jumps to drilldown from a card signal chip', async () => {
		const scrollIntoView = vi.fn();
		Element.prototype.scrollIntoView = scrollIntoView;
		mockedOverview.mockResolvedValue(siteManagerOverview());
		mockedTemplates.mockResolvedValue({
			runtime_mode: 'images',
			templates: [],
		});

		render(<SiteManagerOpsPanel />);

		expect(await screen.findByText('Domain Site')).toBeInTheDocument();
		openSiteManagerView('advanced');
		fireEvent.click(screen.getByText('siteManager.filters.all 2'));
		fireEvent.click(screen.getAllByText('siteManager.drilldown.open')[0]);
		expect(
			await screen.findByText('siteManager.issueDigest.count 0')
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.siteCards.topSignal')
		).toBeInTheDocument();
		expect(
			screen.getAllByText('siteManager.issueDigest.domainOperator').length
		).toBeGreaterThanOrEqual(1);

		fireEvent.click(
			screen.getByText('siteManager.siteCards.selectedSignals 1')
		);

		await waitFor(() =>
			expect(
				window.sessionStorage.getItem(
					'eliteew.siteManagerOps.selectedSiteKey.v1'
				)
			).toBe('user:domain-site')
		);
		expect(
			await screen.findByText('siteManager.issueDigest.count 1')
		).toBeInTheDocument();
		expect(scrollIntoView).toHaveBeenCalledWith({
			block: 'start',
			behavior: 'smooth',
		});
	});

	it('shows info-only digest details without inflating attention signal badges', async () => {
		const overview = siteManagerOverview();
		overview.domains = [];
		overview.dns_outbox = [];
		const runningJob: SiteStudioLifecycleJob = {
			id: 'job-running-start',
			instance_scope: 'user',
			instance_id: 'ready-site',
			site_slug: 'ready',
			task_type: 'site_studio_start',
			status: 'running',
			stage: 'worker_started',
			queued: true,
			worker_id: 'worker-1',
			attempts: 1,
			last_error: null,
			metadata_json: {},
			created_at: '2026-05-29T00:00:00Z',
			queued_at: '2026-05-29T00:00:00Z',
			started_at: '2026-05-29T00:00:10Z',
			finished_at: null,
			updated_at: '2026-05-29T00:00:10Z',
			duration_ms: null,
		};
		overview.jobs = [runningJob];
		mockedOverview.mockResolvedValue(overview);
		mockedTemplates.mockResolvedValue({
			runtime_mode: 'images',
			templates: [],
		});

		render(<SiteManagerOpsPanel />);

		expect(
			await screen.findByText('siteManager.issueDigest.count 1')
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.issueDigest.activeJob')
		).toBeInTheDocument();
		expect(
			screen.getAllByText('siteManager.siteCards.selectedSignals 0').length
		).toBeGreaterThanOrEqual(2);
		expect(
			screen.queryByLabelText('siteManager.siteCards.jumpToSignal')
		).not.toBeInTheDocument();
	});

	it('shows an operator notice when overview collections are truncated', async () => {
		const overview = siteManagerOverview();
		overview.overview_limits = {
			instances: {
				limit: 40,
				returned: 40,
				truncated: true,
			},
			jobs: {
				limit: 20,
				returned: 1,
				truncated: false,
			},
		};
		mockedOverview.mockResolvedValue(overview);
		mockedTemplates.mockResolvedValue({
			runtime_mode: 'images',
			templates: [],
		});

		render(<SiteManagerOpsPanel />);

		expect(
			await screen.findByText('siteManager.overviewLimits.title')
		).toBeInTheDocument();
		expect(
			screen.getByText(/siteManager\.overviewLimits\.collection\.instances/)
		).toHaveTextContent('40/40');
		expect(
			screen.queryByText(/siteManager\.overviewLimits\.collection\.jobs/)
		).not.toBeInTheDocument();
	});

	it('queries server-side instance search when overview instances are truncated', async () => {
		const overview = siteManagerOverview();
		overview.overview_limits = {
			instances: {
				limit: 40,
				returned: 40,
				truncated: true,
			},
		};
		mockedOverview.mockResolvedValue(overview);
		mockedTemplates.mockResolvedValue({
			runtime_mode: 'images',
			templates: [],
		});
		mockedInstances.mockResolvedValue({
			items: [
				{
					instance_scope: 'user',
					id: 'archive-site',
					site_slug: 'archive',
					site_title: 'Archive Site',
					status: 'running',
					publication_state: 'closed',
					public_hostname: 'archive.sites.eliteew.ru',
					public_url: null,
					api_base_url: null,
					compose_project_name: 'archive',
					runtime_dir: '/runtime/archive',
					source_dir: null,
					env_dir: null,
					compose_file_path: '/runtime/archive/docker-compose.yml',
					updated_at: '2026-05-29T00:00:00Z',
					last_error: null,
					marketing_project_id: null,
					client_access_json: {},
				},
			],
			limit: 10,
			offset: 0,
			returned: 1,
			has_more: false,
		});

		render(<SiteManagerOpsPanel />);

		openSiteManagerView('advanced');

		const searchInput = await screen.findByLabelText(
			'siteManager.siteCards.searchLabel'
		);
		fireEvent.change(searchInput, { target: { value: 'archive' } });

		expect(
			await screen.findByTestId('site-manager-instance-search-results')
		).toBeInTheDocument();
		await waitFor(() =>
			expect(mockedInstances).toHaveBeenCalledWith({
				q: 'archive',
				limit: 10,
				offset: 0,
			})
		);
		expect(await screen.findByText('Archive Site')).toBeInTheDocument();
		expect(screen.getByText('archive.sites.eliteew.ru')).toBeInTheDocument();
	});

	it('marks a reconcile drift as failed after operator confirmation', async () => {
		const overview = siteManagerOverview();
		overview.reconcile = {
			count: 1,
			entries: [
				{
					instance: overview.instances[0],
					issues: [
						{
							code: 'stale_transition_status',
							severity: 'hard',
							next_action: 'mark_failed_or_retry',
							message: 'Instance has been starting too long',
						},
					],
				},
			],
			generated_at: '2026-05-29T00:00:00Z',
		};
		mockedOverview.mockResolvedValue(overview);
		mockedTemplates.mockResolvedValue({
			runtime_mode: 'images',
			templates: [],
		});
		mockedMarkReconcileFailed.mockResolvedValue({
			id: 'ready-site',
			site_slug: 'ready',
			status: 'failed',
			publication_state: 'closed',
			public_hostname: 'ready.sites.eliteew.ru',
			last_error: 'Instance has been starting too long',
			updated_at: '2026-05-29T00:03:00Z',
		});

		render(<SiteManagerOpsPanel />);

		expect(
			await screen.findByText('Instance has been starting too long')
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.drilldown.reconcileMessage')
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.drilldown.reconcileSeverity:')
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.drilldown.reconcileCode:')
		).toBeInTheDocument();
		expect(
			screen.getByText('siteManager.drilldown.reconcileNextAction:')
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByText('siteManager.reconcileActions.markFailed')
		);
		expect(mockedMarkReconcileFailed).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByText('siteManager.reconcileActions.confirmMarkFailed')
		);

		await waitFor(() =>
			expect(mockedMarkReconcileFailed).toHaveBeenCalledWith({
				instance_scope: 'user',
				instance_id: 'ready-site',
				reason: expect.stringContaining('stale_transition_status'),
			})
		);
	});

	it('confirms lifecycle job retry and cancel repair actions', async () => {
		const overview = siteManagerOverview();
		const failedJob: SiteStudioLifecycleJob = {
			id: 'job-failed-start',
			instance_scope: 'user',
			instance_id: 'ready-site',
			site_slug: 'ready',
			task_type: 'site_studio_start',
			status: 'failed',
			stage: 'health',
			queued: false,
			worker_id: 'worker-1',
			attempts: 1,
			last_error: 'health failed',
			metadata_json: {},
			created_at: '2026-05-29T00:00:00Z',
			queued_at: null,
			started_at: '2026-05-29T00:00:10Z',
			finished_at: '2026-05-29T00:01:00Z',
			updated_at: '2026-05-29T00:01:00Z',
			duration_ms: 50000,
		};
		const runningStopJob: SiteStudioLifecycleJob = {
			id: 'job-running-stop',
			instance_scope: 'user',
			instance_id: 'ready-site',
			site_slug: 'ready',
			task_type: 'site_studio_stop',
			status: 'running',
			stage: 'worker_started',
			queued: true,
			worker_id: 'worker-1',
			attempts: 1,
			last_error: null,
			metadata_json: {},
			created_at: '2026-05-29T00:02:00Z',
			queued_at: '2026-05-29T00:02:00Z',
			started_at: '2026-05-29T00:02:10Z',
			finished_at: null,
			updated_at: '2026-05-29T00:02:10Z',
			duration_ms: null,
		};
		overview.jobs = [failedJob, runningStopJob];
		mockedOverview.mockResolvedValue(overview);
		mockedTemplates.mockResolvedValue({
			runtime_mode: 'images',
			templates: [],
		});
		mockedRetryJob.mockResolvedValue({
			status: 'starting',
			queued: true,
			detail: 'Retry queued',
			job_id: 'job-retry-new',
			worker_ready: true,
		});
		mockedCancelJob.mockResolvedValue({
			...overview.jobs[1],
			status: 'cancelled',
			stage: 'cancelled_by_site_manager_operator',
			finished_at: '2026-05-29T00:03:00Z',
		});

		render(<SiteManagerOpsPanel />);

		const readyCard = await screen.findByTestId(
			'site-manager-card-user:ready-site'
		);
		fireEvent.click(within(readyCard).getByText('siteManager.drilldown.open'));
		await waitFor(() =>
			expect(screen.getByText('health failed')).toBeInTheDocument()
		);
		expect(
			screen.getByText('siteManager.drilldown.jobLastError')
		).toBeInTheDocument();
		fireEvent.click(screen.getByText('siteManager.jobActions.retry'));
		expect(mockedRetryJob).not.toHaveBeenCalled();
		fireEvent.click(screen.getByText('siteManager.jobActions.confirmRetry'));
		await waitFor(() =>
			expect(mockedRetryJob).toHaveBeenCalledWith('job-failed-start')
		);

		fireEvent.click(screen.getByText('siteManager.jobActions.cancel'));
		expect(mockedCancelJob).not.toHaveBeenCalled();
		fireEvent.click(screen.getByText('siteManager.jobActions.confirmCancel'));
		await waitFor(() =>
			expect(mockedCancelJob).toHaveBeenCalledWith('job-running-stop')
		);
	});

	it('restores and updates selected site from session storage', async () => {
		window.sessionStorage.setItem(
			'eliteew.siteManagerOps.selectedSiteKey.v1',
			'user:domain-site'
		);
		mockedOverview.mockResolvedValue(siteManagerOverview());
		mockedTemplates.mockResolvedValue({
			runtime_mode: 'images',
			templates: [],
		});

		render(<SiteManagerOpsPanel />);

		expect(
			await screen.findByText('siteManager.issueDigest.count 1')
		).toBeInTheDocument();
		expect(
			screen.getAllByText('siteManager.siteCards.selectedSignals 1').length
		).toBeGreaterThanOrEqual(2);
		expect(
			screen.getAllByText('siteManager.issueDigest.domainOperator').length
		).toBeGreaterThanOrEqual(2);

		openSiteManagerView('advanced');
		fireEvent.click(screen.getByText('siteManager.filters.all 2'));
		fireEvent.click(screen.getAllByText('siteManager.drilldown.open')[0]);

		expect(
			window.sessionStorage.getItem('eliteew.siteManagerOps.selectedSiteKey.v1')
		).toBe('user:ready-site');
		expect(
			await screen.findByText('siteManager.issueDigest.count 0')
		).toBeInTheDocument();
	});
});
