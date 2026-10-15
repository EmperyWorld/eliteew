/**
 * Site Manager Ops browser smoke (optional authenticated desktop contour).
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
 *   pnpm exec playwright test e2e/site-manager-ops-click-chains.spec.ts
 */
import { expect, type Page, test } from 'playwright/test';

import { describeDesktop } from './desktopShellE2eGate';

const now = '2026-05-29T00:00:00Z';

function siteManagerOverview() {
	return {
		worker: {
			worker_ready: true,
			worker_id: 'worker-1',
			worker_last_seen_at: now,
			worker_last_seen_age_seconds: 1,
			worker_ready_window_seconds: 180,
		},
		instances: [
			{
				instance_scope: 'user',
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
				updated_at: now,
				last_error: null,
				marketing_project_id: null,
				client_access_json: {},
			},
			{
				instance_scope: 'user',
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
				updated_at: now,
				last_error: null,
				marketing_project_id: null,
				client_access_json: {},
			},
		],
		jobs: [
			{
				id: 'job-ready',
				instance_scope: 'user',
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
				created_at: now,
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
				instance_scope: 'user',
				instance_id: 'domain-site',
				hostname: 'domain.example.test',
				status: 'verified',
				verification_method: 'txt',
				verification_name: '_eliteew-site.domain.example.test',
				verification_token_preview: 'token',
				expected_cname: null,
				verified_at: now,
				last_checked_at: null,
				route_ready_at: null,
				tls_status: 'pending',
				last_error: null,
				metadata_json: {},
				created_at: now,
				updated_at: now,
			},
		],
		dns_outbox: [
			{
				id: 'outbox-1',
				binding_id: 'domain-binding',
				hostname: 'domain.example.test',
				target_hostname: 'domain.sites.eliteew.ru',
				status: 'pending',
				requested_at: now,
				applied_at: null,
				last_error: null,
				metadata_json: {},
			},
		],
		reconcile: {
			count: 0,
			entries: [],
			generated_at: now,
		},
		audit_events: [],
		overview_limits: {},
		generated_at: now,
	};
}

async function installSiteManagerOpsApiMocks(
	page: Page,
	tracker: { outbox: number }
) {
	await page.route(
		'**/api/v1/desktop/site-manager/ops/overview',
		async (route) => {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify(siteManagerOverview()),
			});
		}
	);

	await page.route(
		'**/api/v1/desktop/site-manager/ops/templates',
		async (route) => {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({ runtime_mode: 'images', templates: [] }),
			});
		}
	);

	await page.route(
		'**/api/v1/desktop/site-manager/ops/dns-outbox/outbox-1/mark-applied',
		async (route) => {
			tracker.outbox += 1;
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					...siteManagerOverview().dns_outbox[0],
					status: 'applied',
					applied_at: now,
				}),
			});
		}
	);
}

async function openSiteManagerOps(page: Page) {
	await page.goto('/');
	await expect(page.locator('#desktop-main')).toBeVisible({ timeout: 60_000 });
	await page.evaluate(() => {
		window.dispatchEvent(
			new CustomEvent('desktop-open-app', {
				detail: { appComponent: 'SiteManagerOps' },
			})
		);
	});
	await expect(page.getByTestId('site-manager-ops-root')).toBeVisible({
		timeout: 45_000,
	});
}

describeDesktop('Site Manager Ops click chains', () => {
	test('card signal and digest clicks focus selected-site drilldown sections', async ({
		page,
	}) => {
		await installSiteManagerOpsApiMocks(page, { outbox: 0 });
		await openSiteManagerOps(page);

		await page.getByTestId('site-manager-card-signal-user:domain-site').click();

		await expect(
			page.getByTestId('site-manager-selected-breadcrumb')
		).toContainText('Domain Site');
		await expect(
			page.getByTestId('site-manager-selected-drilldown')
		).toBeVisible();

		await page.getByTestId('site-manager-issue-domain:domain-binding').click();
		await expect(
			page.locator('#site-manager-drilldown-domains')
		).toBeInViewport();

		await page.getByTestId('site-manager-selected-details').click();
		await expect(
			page.getByTestId('site-manager-selected-drilldown')
		).toBeInViewport();
	});

	test('domain repair confirmation requires a second click before mutation', async ({
		page,
	}) => {
		const tracker = { outbox: 0 };
		await installSiteManagerOpsApiMocks(page, tracker);
		await openSiteManagerOps(page);

		const routeApplied = page.getByTestId(
			'site-manager-confirm-action-outbox:outbox-1'
		);
		await routeApplied.scrollIntoViewIfNeeded();
		await routeApplied.click();
		expect(tracker.outbox).toBe(0);

		await routeApplied.click();
		await expect.poll(() => tracker.outbox, { timeout: 10_000 }).toBe(1);
	});
});
