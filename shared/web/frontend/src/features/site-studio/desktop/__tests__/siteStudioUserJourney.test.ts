/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit coverage for Site Studio user journey stage, action, and blocker derivation.
 *
 * Invariants:
 * - Journey derivation is pure and does not depend on rendered React state.
 * - Blocked runtime copy is derived before exposing launch actions.
 *
 * Related:
 * - ../siteStudioUserJourney.ts
 */
import { describe, expect, it } from 'vitest';

import type {
	SiteStudioDraftState,
	SiteStudioHealth,
	SiteStudioInstance,
} from '../api';
import { computeSiteStudioUserJourney } from '../siteStudioUserJourney';

const baseInstance: SiteStudioInstance = {
	id: 'site-1',
	user_id: 'user-1',
	template_key: 'default',
	site_slug: 'demo',
	site_title: 'Demo',
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

const baseDrafts: SiteStudioDraftState = {
	brief: 'Local bakery',
	siteBlueprint: { toneOfVoice: 'warm' },
	assistantMessages: [],
	contentDrafts: [
		{
			id: 'content-1',
			draftKey: 'hero',
			title: 'Hero',
			summary: 'Hero copy',
			createdAt: '2026-05-29T00:00:00Z',
			blocks: [
				{
					page: 'home',
					section: 'hero',
					key: 'title',
					label: 'Hero title',
					value: 'Fresh bread',
				},
			],
		},
	],
	seoDrafts: [],
	imageDrafts: [],
};

const baseHealth: SiteStudioHealth = {
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

describe('computeSiteStudioUserJourney', () => {
	it('derives AI fill when no blueprint exists', () => {
		const journey = computeSiteStudioUserJourney({
			instance: baseInstance,
			health: baseHealth,
			drafts: { ...baseDrafts, siteBlueprint: null, contentDrafts: [] },
			busyKeys: new Set(),
			applyReports: {},
			adminShellReady: false,
		});

		expect(journey.stage).toBe('ai_fill');
		expect(journey.primaryAction).toMatchObject({
			kind: 'tab',
			tab: 'autofill',
		});
	});

	it('routes review to apply-all when generated drafts are not applied yet', () => {
		const journey = computeSiteStudioUserJourney({
			instance: baseInstance,
			health: baseHealth,
			drafts: baseDrafts,
			busyKeys: new Set(),
			applyReports: {},
			adminShellReady: false,
		});

		expect(journey.stage).toBe('review');
		expect(journey.primaryAction).toMatchObject({ kind: 'apply_all' });
	});

	it('blocks runtime launch when the worker is not ready', () => {
		const journey = computeSiteStudioUserJourney({
			instance: baseInstance,
			health: { ...baseHealth, worker_ready: false },
			drafts: {
				...baseDrafts,
				imageDrafts: [
					{
						id: 'image-1',
						slotId: 'hero',
						title: 'Hero image',
						description: 'A warm bakery',
						page: 'home',
						section: 'hero',
						key: 'image',
						alt: 'Bakery',
						imageUrl: 'https://example.test/image.png',
						prompt: 'Bakery',
						width: 1024,
						height: 768,
						createdAt: '2026-05-29T00:00:00Z',
					},
				],
			},
			busyKeys: new Set(),
			applyReports: {
				'content-1': {
					kind: 'content',
					status: 'applied',
					applied: 1,
					skipped: 0,
					failed: 0,
					message: 'ok',
				},
			},
			adminShellReady: false,
		});

		expect(journey.stage).toBe('blocked');
		expect(journey.blockerKey).toBe('journey.blockers.runtimeWorker');
	});

	it('offers admin review during publish readiness before going live', () => {
		const journey = computeSiteStudioUserJourney({
			instance: { ...baseInstance, status: 'running' },
			health: { ...baseHealth, status: 'running' },
			drafts: {
				...baseDrafts,
				imageDrafts: [
					{
						id: 'image-1',
						slotId: 'hero',
						title: 'Hero image',
						description: 'A warm bakery',
						page: 'home',
						section: 'hero',
						key: 'image',
						alt: 'Bakery',
						imageUrl: 'https://example.test/image.png',
						prompt: 'Bakery',
						width: 1024,
						height: 768,
						createdAt: '2026-05-29T00:00:00Z',
					},
				],
			},
			busyKeys: new Set(),
			applyReports: {
				'content-1': {
					kind: 'content',
					status: 'applied',
					applied: 1,
					skipped: 0,
					failed: 0,
					message: 'ok',
				},
			},
			adminShellReady: true,
		});

		expect(journey.stage).toBe('publish');
		expect(journey.primaryAction).toMatchObject({
			kind: 'runtime',
			action: 'publish',
		});
		expect(journey.secondaryActions).toContainEqual(
			expect.objectContaining({ kind: 'open_admin' })
		);
	});

	it('marks Edge needs-attention when CMS open but content_source is stub', () => {
		const journey = computeSiteStudioUserJourney({
			instance: {
				...baseInstance,
				status: 'running',
				publication_state: 'open',
				public_url: 'http://192.168.1.10:8087',
			},
			health: {
				...baseHealth,
				status: 'running',
				edge: {
					enabled: true,
					ssh_configured: true,
					port: 8087,
					url: 'http://192.168.1.10:8087',
					last_error: null,
					deployed_at: '2026-07-15T00:00:00Z',
					content_source: 'stub',
				},
			},
			drafts: {
				...baseDrafts,
				imageDrafts: [
					{
						id: 'image-1',
						slotId: 'hero',
						title: 'Hero image',
						description: 'A warm bakery',
						page: 'home',
						section: 'hero',
						key: 'image',
						alt: 'Bakery',
						imageUrl: 'https://example.test/image.png',
						prompt: 'Bakery',
						width: 1024,
						height: 768,
						createdAt: '2026-05-29T00:00:00Z',
					},
				],
			},
			busyKeys: new Set(),
			applyReports: {
				'content-1': {
					kind: 'content',
					status: 'applied',
					applied: 1,
					skipped: 0,
					failed: 0,
					message: 'ok',
				},
			},
			adminShellReady: true,
		});

		expect(journey.stage).toBe('blocked');
		expect(journey.blockerKey).toBe('journey.blockers.edgeNeedsAttention');
	});

	it('exposes Edge visitor CTA when content_source is runtime_dist', () => {
		const journey = computeSiteStudioUserJourney({
			instance: {
				...baseInstance,
				status: 'running',
				publication_state: 'open',
				public_url: 'http://192.168.1.10:8087',
			},
			health: {
				...baseHealth,
				status: 'running',
				edge: {
					enabled: true,
					ssh_configured: true,
					port: 8087,
					url: 'http://192.168.1.10:8087',
					last_error: null,
					deployed_at: '2026-07-15T00:00:00Z',
					content_source: 'runtime_dist',
				},
			},
			drafts: {
				...baseDrafts,
				imageDrafts: [
					{
						id: 'image-1',
						slotId: 'hero',
						title: 'Hero image',
						description: 'A warm bakery',
						page: 'home',
						section: 'hero',
						key: 'image',
						alt: 'Bakery',
						imageUrl: 'https://example.test/image.png',
						prompt: 'Bakery',
						width: 1024,
						height: 768,
						createdAt: '2026-05-29T00:00:00Z',
					},
				],
			},
			busyKeys: new Set(),
			applyReports: {
				'content-1': {
					kind: 'content',
					status: 'applied',
					applied: 1,
					skipped: 0,
					failed: 0,
					message: 'ok',
				},
			},
			adminShellReady: true,
		});

		expect(journey.stage).toBe('live');
		expect(journey.primaryAction).toMatchObject({
			kind: 'open_public',
			labelKey: 'journey.actions.openEdgePublic',
		});
	});
});
