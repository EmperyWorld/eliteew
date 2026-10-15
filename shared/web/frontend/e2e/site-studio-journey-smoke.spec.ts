/**
 * Site Studio journey browser smoke (optional authenticated desktop contour).
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
 *   pnpm exec playwright test e2e/site-studio-journey-smoke.spec.ts
 */
import { expect, type Page, test } from 'playwright/test';

import { describeDesktop } from './desktopShellE2eGate';

const now = '2026-05-29T00:00:00Z';

function siteStudioInstance() {
	return {
		id: 'site-1',
		user_id: 'user-1',
		template_key: 'olenti',
		site_slug: 'atelier',
		site_title: 'Atelier Site',
		site_topic: 'Perfume atelier',
		brief_json: {},
		status: 'running',
		public_hostname: 'atelier.sites.eliteew.ru',
		publication_state: 'closed',
		public_url: null,
		api_base_url: null,
		opened_at: null,
		closed_at: null,
		admin_email: null,
		runtime_dir: '/runtime/atelier',
		source_dir: null,
		env_dir: null,
		compose_file_path: '/runtime/atelier/docker-compose.yml',
		compose_project_name: 'site-studio-atelier',
		ports_json: {},
		db_name: null,
		last_error: null,
		last_provisioned_at: now,
		created_at: now,
		updated_at: now,
	};
}

function siteStudioDrafts() {
	return {
		brief: 'Premium perfume atelier site',
		siteBlueprint: {
			brandCore: 'Private perfume atelier',
			offer: 'Custom fragrance consultations',
			visualDirection: 'Warm amber editorial',
		},
		assistantMessages: [],
		contentDrafts: [
			{
				id: 'content-1',
				title: 'Home draft',
				summary: 'Hero and about sections',
				blocks: [
					{
						page: 'home',
						section: 'hero',
						key: 'headline',
						label: 'Headline',
						value: 'A private scent atelier',
					},
				],
				createdAt: now,
			},
		],
		seoDrafts: [
			{
				id: 'seo-1',
				title: 'SEO basics',
				summary: 'Search preview',
				siteSettings: {
					siteTitle: 'Atelier Site',
					siteDescription: 'Private perfume consultations',
				},
				keywords: ['perfume', 'atelier'],
				suggestions: [],
				createdAt: now,
			},
		],
		imageDrafts: [
			{
				id: 'image-1',
				slotId: 'home.hero.background',
				title: 'Hero background',
				description: 'Warm atelier table',
				page: 'home',
				section: 'hero',
				key: 'background',
				imageUrl: 'https://example.test/hero.jpg',
				alt: 'Perfume bottles on an atelier table',
				prompt: 'Text-free warm perfume atelier table',
				createdAt: now,
			},
		],
	};
}

async function installSiteStudioApiMocks(page: Page) {
	await page.route('**/api/v1/desktop/site-studio/instance', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify(siteStudioInstance()),
		});
	});

	await page.route('**/api/v1/desktop/site-studio/ai/drafts', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify(siteStudioDrafts()),
		});
	});

	await page.route(
		'**/api/v1/desktop/site-studio/ai/catalog',
		async (route) => {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					contentPacks: [],
					imageSlots: [
						{
							slotId: 'home.hero.background',
							title: 'Hero background',
							description: 'Warm atelier table',
							recommendedWidth: 1600,
							recommendedHeight: 900,
						},
					],
				}),
			});
		}
	);

	await page.route(
		'**/api/v1/desktop/site-studio/instance/domains',
		async (route) => {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify([]),
			});
		}
	);
}

async function openSiteStudio(page: Page) {
	await page.goto('/');
	await expect(page.locator('#desktop-main')).toBeVisible({ timeout: 60_000 });
	await page.evaluate(() => {
		window.dispatchEvent(
			new CustomEvent('desktop-open-app', {
				detail: { appComponent: 'UserSiteStudio' },
			})
		);
	});
	await expect(page.getByText('Atelier Site')).toBeVisible({
		timeout: 45_000,
	});
}

describeDesktop('Site Studio journey smoke', () => {
	test('stage shell, auto-fill and draft review surfaces render with mocks', async ({
		page,
	}) => {
		await installSiteStudioApiMocks(page);
		await openSiteStudio(page);

		const stageNav = page.getByTestId('site-studio-stage-nav');
		await expect(stageNav).toBeVisible();
		await expect(page.getByTestId('site-studio-tools-nav')).toBeVisible();
		await expect(page.getByText(/Маршрут запуска|Launch route/)).toBeVisible();

		await stageNav.getByRole('button', { name: /Заполнение|Fill/ }).click();
		await expect(page.locator('#site-studio-panel-autofill')).toBeVisible();
		await expect(
			page.getByText(/Автозаполнение сайта|Site auto-fill/)
		).toBeVisible();

		await stageNav.getByRole('button', { name: /Проверка|Review/ }).click();
		await expect(page.getByText('Home draft')).toBeVisible();
		await expect(page.getByText('SEO basics')).toBeVisible();

		await stageNav.getByRole('button', { name: /Визуалы|Visuals/ }).click();
		await expect(page.getByText('Hero background')).toBeVisible();

		await expect(page.locator('body')).not.toContainText('runtime_dist');
	});
});
