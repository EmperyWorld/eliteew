/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit coverage for Site Manager user-facing status, domain stepper, and recovery derivation.
 *
 * Invariants:
 * - Status derivation uses existing ops overview data only.
 * - Failed jobs/reconcile findings take priority over publish-ready states.
 *
 * Related:
 * - ../siteManagerUserStatus.ts
 */
import { describe, expect, it } from 'vitest';

import type {
	SiteManagerOpsOverview,
	SiteManagerOpsRuntimeInstance,
	SiteStudioDomainBinding,
} from '../api';
import {
	buildSiteManagerIssueDigestSummary,
	buildSiteManagerSupportSummary,
	deriveSiteManagerDomainFlow,
	deriveSiteManagerIssueDigest,
	deriveSiteManagerSiteDrilldown,
	deriveSiteManagerUxOverview,
	filterSiteManagerAttentionIssues,
	filterSiteManagerUxCards,
	searchAndSortSiteManagerUxCards,
} from '../siteManagerUserStatus';

const instance = (
	overrides: Partial<SiteManagerOpsRuntimeInstance> = {}
): SiteManagerOpsRuntimeInstance => ({
	instance_scope: 'user',
	id: 'site-1',
	site_slug: 'demo',
	site_title: 'Demo',
	status: 'running',
	publication_state: 'closed',
	public_hostname: 'demo.sites.eliteew.ru',
	public_url: null,
	api_base_url: null,
	compose_project_name: 'site-demo',
	runtime_dir: '/runtime/demo',
	source_dir: null,
	env_dir: null,
	compose_file_path: '/runtime/demo/docker-compose.yml',
	updated_at: '2026-05-29T00:00:00Z',
	last_error: null,
	marketing_project_id: null,
	client_access_json: {},
	...overrides,
});

const domain = (
	overrides: Partial<SiteStudioDomainBinding> = {}
): SiteStudioDomainBinding => ({
	id: 'domain-1',
	instance_scope: 'user',
	instance_id: 'site-1',
	hostname: 'demo.example.test',
	status: 'pending',
	verification_method: 'txt',
	verification_name: '_eliteew-site.demo.example.test',
	verification_token_preview: 'token',
	expected_cname: null,
	verified_at: null,
	last_checked_at: null,
	route_ready_at: null,
	tls_status: 'pending',
	last_error: null,
	metadata_json: {},
	created_at: '2026-05-29T00:00:00Z',
	updated_at: '2026-05-29T00:00:00Z',
	...overrides,
});

const overview = (
	overrides: Partial<SiteManagerOpsOverview> = {}
): SiteManagerOpsOverview => ({
	worker: {
		worker_ready: true,
		worker_id: 'worker-1',
		worker_last_seen_at: '2026-05-29T00:00:00Z',
		worker_last_seen_age_seconds: 1,
		worker_ready_window_seconds: 180,
	},
	jobs: [],
	domains: [],
	dns_outbox: [],
	instances: [instance()],
	reconcile: {
		count: 0,
		entries: [],
		generated_at: '2026-05-29T00:00:00Z',
	},
	audit_events: [],
	generated_at: '2026-05-29T00:00:00Z',
	...overrides,
});

describe('deriveSiteManagerDomainFlow', () => {
	it('marks verified domains waiting for route as the current step', () => {
		const flow = deriveSiteManagerDomainFlow(
			domain({
				status: 'verified',
				verified_at: '2026-05-29T00:00:00Z',
			})
		);

		expect(flow.statusKey).toBe('siteManager.domainStatus.requestRoute');
		expect(flow.steps.map((step) => [step.id, step.status])).toContainEqual([
			'route',
			'current',
		]);
	});
});

describe('deriveSiteManagerUxOverview', () => {
	it('derives domain-pending cards before publish checks', () => {
		const derived = deriveSiteManagerUxOverview(
			overview({
				domains: [
					domain({ status: 'verified', verified_at: '2026-05-29T00:00:00Z' }),
				],
			})
		);

		expect(derived.cards[0]?.state).toBe('domain_pending');
		expect(derived.cards[0]?.nextAction).toBe('check_domain');
		expect(derived.counts.domains_pending).toBe(1);
	});

	it('prioritizes failed jobs and filters recovery cards', () => {
		const derived = deriveSiteManagerUxOverview(
			overview({
				jobs: [
					{
						id: 'job-1',
						instance_scope: 'user',
						instance_id: 'site-1',
						site_slug: 'demo',
						task_type: 'start',
						status: 'failed',
						stage: 'health',
						queued: false,
						worker_id: 'worker-1',
						attempts: 1,
						last_error: 'health failed',
						metadata_json: {},
						created_at: '2026-05-29T00:00:00Z',
						queued_at: null,
						started_at: null,
						finished_at: '2026-05-29T00:01:00Z',
						updated_at: '2026-05-29T00:01:00Z',
						duration_ms: 1000,
					},
				],
			})
		);

		expect(derived.cards[0]?.state).toBe('needs_attention');
		expect(derived.cards[0]?.severity).toBe('danger');
		expect(derived.recoveryCards).toHaveLength(1);
		expect(
			filterSiteManagerUxCards(derived.cards, 'needs_attention')
		).toHaveLength(1);
	});

	it('keeps runtime errors and failed smoke out of ok severity', () => {
		const runtimeError = deriveSiteManagerUxOverview(
			overview({
				instances: [instance({ last_error: 'runtime failed' })],
			})
		);
		const failedSmoke = deriveSiteManagerUxOverview(overview(), {
			'user:site-1': {
				instance_scope: 'user',
				instance_id: 'site-1',
				status: 'failed',
				checks: [
					{
						key: 'storefront_http',
						ok: false,
						severity: 'hard',
						message: 'Storefront failed',
					},
				],
				hard_failure_count: 1,
				generated_at: '2026-05-29T00:00:00Z',
			},
		});

		expect(runtimeError.cards[0]?.severity).toBe('danger');
		expect(failedSmoke.cards[0]?.severity).toBe('danger');
	});

	it('searches and sorts cards for larger fleets', () => {
		const derived = deriveSiteManagerUxOverview(
			overview({
				instances: [
					instance({
						id: 'site-older',
						site_slug: 'older',
						site_title: 'Older Site',
						updated_at: '2026-05-28T00:00:00Z',
					}),
					instance({
						id: 'site-domain',
						site_slug: 'domain',
						site_title: 'Domain Site',
						public_hostname: 'domain.sites.eliteew.ru',
						updated_at: '2026-05-29T00:00:00Z',
					}),
				],
				domains: [
					domain({
						id: 'domain-2',
						instance_id: 'site-domain',
						hostname: 'custom.example.test',
					}),
				],
			})
		);

		expect(
			searchAndSortSiteManagerUxCards(derived.cards, {
				filter: 'all',
				query: 'custom.example',
				sort: 'updated_desc',
			}).map((card) => card.key)
		).toEqual(['user:site-domain']);
		expect(
			searchAndSortSiteManagerUxCards(derived.cards, {
				filter: 'all',
				query: '',
				sort: 'updated_desc',
			}).map((card) => card.key)
		).toEqual(['user:site-domain', 'user:site-older']);
	});
});

describe('buildSiteManagerSupportSummary', () => {
	it('formats selected-site handoff data for support', () => {
		const source = overview({
			jobs: [
				{
					id: 'job-1',
					instance_scope: 'user',
					instance_id: 'site-1',
					site_slug: 'demo',
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
			domains: [domain({ status: 'active', tls_status: 'ready' })],
			audit_events: [
				{
					id: 'audit-1',
					actor_user_id: 'operator',
					action: 'publish_smoke',
					target_type: 'site',
					target_id: 'site-1',
					before_json: null,
					after_json: null,
					result_json: null,
					metadata_json: {},
					created_at: '2026-05-29T00:02:00Z',
				},
			],
		});
		const ux = deriveSiteManagerUxOverview(source, {
			'user:site-1': {
				instance_scope: 'user',
				instance_id: 'site-1',
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
			},
		});

		const summary = buildSiteManagerSupportSummary(
			deriveSiteManagerSiteDrilldown(source, ux.cards[0])
		);

		expect(summary).toContain('[Site Manager support summary]');
		expect(summary).toContain('Site: Demo');
		expect(summary).toContain('job-1: publish/finished');
		expect(summary).toContain('storefront_http: ok');
		expect(summary).toContain('publish_smoke: site/site-1');
	});

	it('accepts localized export labels while preserving diagnostic ids', () => {
		const source = overview({
			jobs: [
				{
					id: 'job-1',
					instance_scope: 'user',
					instance_id: 'site-1',
					site_slug: 'demo',
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
				domain({ status: 'verified', verified_at: '2026-05-29T00:00:00Z' }),
			],
		});
		const ux = deriveSiteManagerUxOverview(source);
		const drilldown = deriveSiteManagerSiteDrilldown(source, ux.cards[0]);
		const copy = {
			headerSupport: 'Резюме Site Manager для поддержки',
			headerDigest: 'Сигналы Site Manager',
			site: 'Сайт',
			scopeId: 'Контур/id',
			slugStatus: 'Slug/статус',
			publication: 'Публикация',
			publicUrl: 'Публичная ссылка',
			uxState: 'Состояние UI',
			nextAction: 'Следующее действие',
			lastError: 'Последняя ошибка',
			domains: 'Домены',
			jobs: 'Задачи',
			publishSmoke: 'Проверка публикации',
			audit: 'Журнал событий',
			signals: 'Сигналов',
			notSet: 'не задано',
			none: 'нет',
			pending: 'ожидает',
			ok: 'ok',
			fail: 'fail',
			hardFailures: 'hard_failures',
			tls: 'tls',
			route: 'route',
			stage: 'stage',
			error: 'error',
			at: 'в',
		};

		const supportSummary = buildSiteManagerSupportSummary(drilldown, copy);
		const digestSummary = buildSiteManagerIssueDigestSummary(drilldown, copy);

		expect(supportSummary).toContain('[Резюме Site Manager для поддержки]');
		expect(supportSummary).toContain('Сайт: Demo');
		expect(supportSummary).toContain('Контур/id: user/site-1');
		expect(supportSummary).toContain('job-1: publish/finished');
		expect(digestSummary).toContain('[Сигналы Site Manager]');
		expect(digestSummary).toContain('Сигналов: 1');
		expect(digestSummary).toContain('INFO domain: demo.example.test');
	});
});

describe('deriveSiteManagerIssueDigest', () => {
	it('keeps informational digest items out of attention signal counts', () => {
		const source = overview({
			jobs: [
				{
					id: 'job-running',
					instance_scope: 'user',
					instance_id: 'site-1',
					site_slug: 'demo',
					task_type: 'start',
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
				},
			],
		});
		const ux = deriveSiteManagerUxOverview(source);
		const issues = deriveSiteManagerIssueDigest(
			deriveSiteManagerSiteDrilldown(source, ux.cards[0])
		);

		expect(issues).toHaveLength(1);
		expect(issues[0]?.severity).toBe('info');
		expect(filterSiteManagerAttentionIssues(issues)).toHaveLength(0);
	});

	it('groups selected-site domain, job, reconcile and smoke signals by severity', () => {
		const source = overview({
			domains: [
				domain({ status: 'verified', verified_at: '2026-05-29T00:00:00Z' }),
			],
			dns_outbox: [
				{
					id: 'outbox-1',
					binding_id: 'domain-1',
					hostname: 'demo.example.test',
					target_hostname: 'demo.sites.eliteew.ru',
					status: 'pending',
					requested_at: '2026-05-29T00:00:00Z',
					applied_at: null,
					last_error: null,
					metadata_json: {},
				},
			],
			jobs: [
				{
					id: 'job-1',
					instance_scope: 'user',
					instance_id: 'site-1',
					site_slug: 'demo',
					task_type: 'start',
					status: 'failed',
					stage: 'health',
					queued: false,
					worker_id: 'worker-1',
					attempts: 1,
					last_error: 'health failed',
					metadata_json: {},
					created_at: '2026-05-29T00:00:00Z',
					queued_at: null,
					started_at: null,
					finished_at: '2026-05-29T00:01:00Z',
					updated_at: '2026-05-29T00:01:00Z',
					duration_ms: 1000,
				},
			],
			reconcile: {
				count: 1,
				entries: [
					{
						instance: instance(),
						issues: [
							{
								code: 'runtime_missing',
								severity: 'hard',
								next_action: 'mark failed',
								message: 'Runtime metadata missing',
							},
						],
					},
				],
				generated_at: '2026-05-29T00:00:00Z',
			},
		});
		const ux = deriveSiteManagerUxOverview(source, {
			'user:site-1': {
				instance_scope: 'user',
				instance_id: 'site-1',
				status: 'failed',
				checks: [
					{
						key: 'storefront_http',
						ok: false,
						severity: 'hard',
						message: 'Storefront failed',
					},
				],
				hard_failure_count: 1,
				generated_at: '2026-05-29T00:00:00Z',
			},
		});

		const issues = deriveSiteManagerIssueDigest(
			deriveSiteManagerSiteDrilldown(source, ux.cards[0])
		);

		expect(issues.map((issue) => issue.kind)).toEqual([
			'job',
			'reconcile',
			'smoke',
			'domain',
		]);
		expect(issues.map((issue) => issue.targetSectionId)).toEqual([
			'jobs',
			'reconcile',
			'smoke',
			'domains',
		]);
		expect(issues[0]?.severity).toBe('danger');
		expect(
			issues.some((issue) => issue.titleKey.endsWith('domainOperator'))
		).toBe(true);

		const digestSummary = buildSiteManagerIssueDigestSummary(
			deriveSiteManagerSiteDrilldown(source, ux.cards[0])
		);
		expect(digestSummary).toContain('[Site Manager issue digest]');
		expect(digestSummary).toContain('Signals: 4');
		expect(digestSummary).toContain('DANGER job: Start · Failed');
		expect(digestSummary).toContain('WARN domain: demo.example.test');
	});
});
