/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Site Studio workspace boot, copy, and tab scroll behavior.
 *
 * Invariants:
 * - `UserSiteStudioApp` must render the create/recover screen when no instance exists.
 * - Null instance state must not touch runtime/public URL fields during hook creation.
 * - Route guidance belongs inside the active tab scroll container.
 *
 * Related:
 * - ../UserSiteStudioApp.tsx
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enSiteStudio from '@/i18n/locales/en/siteStudio.json';
import ruSiteStudio from '@/i18n/locales/ru/siteStudio.json';

import { UserSiteStudioApp } from '../UserSiteStudioApp';
import {
	getSiteStudioAiCatalog,
	getSiteStudioDrafts,
	getSiteStudioHealth,
	getSiteStudioInstance,
	type SiteStudioAiCatalog,
	type SiteStudioDraftState,
	type SiteStudioHealth,
	type SiteStudioInstance,
} from '../api';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		i18n: { language: 'ru' },
		t: (key: string, params?: Record<string, unknown>) =>
			params ? `${key} ${JSON.stringify(params)}` : key,
	}),
}));

vi.mock('../SiteStudioAdminShell', () => ({
	SiteStudioAdminShell: () => <div data-testid="site-studio-admin-shell" />,
}));

vi.mock('../api', () => ({
	SiteStudioImageFetchError: class SiteStudioImageFetchError extends Error {},
	applySiteStudioContentDraft: vi.fn(),
	applySiteStudioImageDraft: vi.fn(),
	applySiteStudioSeoDraft: vi.fn(),
	assistSiteStudio: vi.fn(),
	createSiteStudioInstance: vi.fn(),
	deleteSiteStudioInstance: vi.fn(),
	extractSiteStudioImageUrl: vi.fn(),
	fetchSiteStudioImageBlob: vi.fn(),
	generateSiteStudioBrief: vi.fn(),
	generateSiteStudioContentPack: vi.fn(),
	generateSiteStudioSeoPack: vi.fn(),
	getSiteStudioAiCatalog: vi.fn(),
	getSiteStudioDrafts: vi.fn(),
	getSiteStudioHealth: vi.fn(),
	getSiteStudioInstance: vi.fn(),
	isSiteStudioDataUrl: vi.fn((value: string) => value.startsWith('data:')),
	provisionSiteStudioInstance: vi.fn(),
	publishSiteStudioInstance: vi.fn(),
	redeploySiteStudioInstance: vi.fn(),
	saveSiteStudioImageDraft: vi.fn(),
	startSiteStudioInstance: vi.fn(),
	stopSiteStudioInstance: vi.fn(),
	streamSiteStudioImageGeneration: vi.fn(),
	unpublishSiteStudioInstance: vi.fn(),
	updateSiteStudioInstance: vi.fn(),
}));

const mockedGetInstance = vi.mocked(getSiteStudioInstance);
const mockedGetDrafts = vi.mocked(getSiteStudioDrafts);
const mockedGetCatalog = vi.mocked(getSiteStudioAiCatalog);
const mockedGetHealth = vi.mocked(getSiteStudioHealth);

const rawTechnicalIntroCopyPattern =
	/Site Studio|site workspace|\bworkspace\b|Brief|AI Studio|brief wizard|content packs|image drafts|storefront|\bruntime\b|apply-flow/u;
const rawTechnicalSetupCopyPattern =
	/Brand Setup|AI brief wizard|AI Studio|\bBrief\b|site title|topic, brief|Blueprint Snapshot|tone of voice|future runtime/u;
const rawTechnicalWorkspaceCopyPattern =
	/AI Quick Actions|Blueprint Snapshot|Apply To Site|Content Draft|SEO Draft|Image Draft|site settings|Site description|Keywords|Suggestions|Image Studio|\bUGS\b|\bPrompt\b/u;

const instance: SiteStudioInstance = {
	id: 'site-1',
	user_id: 'user-1',
	template_key: 'olenti',
	site_slug: 'demo-site',
	site_title: 'Demo Site',
	site_topic: 'Demo topic',
	brief_json: { brief: 'Demo brief' },
	status: 'draft',
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
	compose_file_path: null,
	compose_project_name: null,
	ports_json: {},
	db_name: null,
	last_error: null,
	last_provisioned_at: null,
	created_at: '2026-05-29T00:00:00Z',
	updated_at: '2026-05-29T00:00:00Z',
};

const drafts: SiteStudioDraftState = {
	brief: 'Demo brief',
	siteBlueprint: { toneOfVoice: 'calm', audience: 'founders' },
	assistantMessages: [
		{
			id: 'msg-1',
			role: 'assistant',
			content: 'Готова помочь с сайтом.',
			createdAt: '2026-05-29T00:00:00Z',
		},
	],
	contentDrafts: [
		{
			id: 'content-1',
			draftKey: 'hero',
			title: 'Главная',
			summary: 'Первый экран',
			createdAt: '2026-05-29T00:00:00Z',
			blocks: [
				{
					page: 'home',
					section: 'hero',
					key: 'title',
					label: 'Заголовок',
					value: 'Сайт без лишнего шума',
				},
			],
		},
	],
	seoDrafts: [
		{
			id: 'seo-1',
			title: 'SEO',
			summary: 'Поисковая основа',
			createdAt: '2026-05-29T00:00:00Z',
			siteSettings: {
				siteTitle: 'Demo',
				siteDescription: 'Описание для поиска',
			},
			keywords: ['demo'],
			suggestions: ['Добавить описание услуг'],
		},
	],
	imageDrafts: [
		{
			id: 'image-1',
			slotId: 'hero',
			title: 'Первый экран',
			description: 'Фоновое изображение',
			page: 'home',
			section: 'hero',
			key: 'background',
			alt: 'Абстрактный фон',
			imageUrl:
				'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
			prompt: 'warm minimal background',
			width: 1024,
			height: 768,
			createdAt: '2026-05-29T00:00:00Z',
		},
	],
};

const catalog: SiteStudioAiCatalog = {
	contentPacks: [
		{
			key: 'hero',
			title: 'Главная',
			description: 'Первый экран',
			blockCount: 1,
		},
	],
	imageSlots: [
		{
			slotId: 'hero',
			title: 'Первый экран',
			description: 'Фон для витрины',
			page: 'home',
			section: 'hero',
			key: 'background',
			alt: 'Фон',
			recommendedWidth: 1024,
			recommendedHeight: 768,
		},
	],
};

const emptySiteStudioHealth: SiteStudioHealth = {
	status: 'unknown',
	api_ok: false,
	public_ok: false,
	api_error: null,
	public_error: null,
	ports: {},
	public_hostname: null,
	publication_state: null,
	public_url: null,
	api_base_url: null,
	worker_ready: false,
	worker_id: null,
	worker_last_seen_at: null,
	worker_last_seen_age_seconds: null,
	worker_ready_window_seconds: null,
	last_job: null,
	pending_job: null,
};

describe('UserSiteStudioApp null instance boot', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedGetInstance.mockResolvedValue(null);
		mockedGetDrafts.mockResolvedValue(drafts);
		mockedGetCatalog.mockResolvedValue(catalog);
		mockedGetHealth.mockResolvedValue(emptySiteStudioHealth);
	});

	it('renders create site screen without reading public_url from null instance', async () => {
		render(<UserSiteStudioApp />);

		expect(
			await screen.findByText('setup.firstRun.createButton')
		).toBeInTheDocument();
		expect(mockedGetInstance).toHaveBeenCalled();
	});

	it('keeps the first-run intro in user-facing language', async () => {
		const { container } = render(<UserSiteStudioApp />);

		expect(await screen.findByText('setup.firstRun.title')).toBeInTheDocument();
		expect(screen.getByText('setup.firstRun.briefLabel')).toBeInTheDocument();
		expect(container.textContent ?? '').not.toMatch(
			rawTechnicalIntroCopyPattern
		);
	});

	it('keeps generated-draft panels in user-facing language', async () => {
		mockedGetInstance.mockResolvedValue(instance);
		const { container } = render(<UserSiteStudioApp />);

		await screen.findByText('Demo Site');

		fireEvent.click(screen.getByText('tabs.ai'));
		expect(
			await screen.findByText('assistant.quickActionsTitle')
		).toBeInTheDocument();
		expect(screen.getByText('assistant.blueprintTitle')).toBeInTheDocument();

		const stageNav = screen.getByTestId('site-studio-stage-nav');
		fireEvent.click(within(stageNav).getByText('journey.steps.review.title'));
		expect(
			await screen.findByText('draftReview.panelTitle')
		).toBeInTheDocument();
		expect(screen.getByText('draftReview.summaryTitle')).toBeInTheDocument();
		expect(
			screen.getByText('draftReview.summaryNeedsReviewHint')
		).toBeInTheDocument();
		expect(screen.getByText('draftReview.contentEyebrow')).toBeInTheDocument();
		expect(screen.getByText('draftReview.seoEyebrow')).toBeInTheDocument();
		expect(screen.getByText('draftReview.keywordsLabel')).toBeInTheDocument();

		fireEvent.click(within(stageNav).getByText('journey.steps.media.title'));
		expect(await screen.findByText('media.panelTitle')).toBeInTheDocument();
		expect(screen.getByText('media.summaryTitle')).toBeInTheDocument();
		expect(screen.getByText('media.summaryReadyHint')).toBeInTheDocument();
		expect(screen.getByText('media.slotReady')).toBeInTheDocument();
		expect(screen.getByText('media.slotStatusTitle')).toBeInTheDocument();
		expect(screen.getByText('media.imageEyebrow')).toBeInTheDocument();
		expect(screen.getByText('media.detailsTitle')).toBeInTheDocument();
		expect(screen.getByText('media.promptTitle')).toBeInTheDocument();
		expect(container.textContent ?? '').not.toMatch(
			rawTechnicalWorkspaceCopyPattern
		);
	});

	it('keeps existing-site setup and assistant copy in user-facing language', async () => {
		mockedGetInstance.mockResolvedValue(instance);
		const { container } = render(<UserSiteStudioApp />);

		await screen.findByText('Demo Site');
		expect(screen.getByText('setup.existingTitle')).toBeInTheDocument();
		expect(screen.getByText('setup.descriptionLabel')).toBeInTheDocument();
		expect(
			screen.getByText('setup.generateStructureButton')
		).toBeInTheDocument();
		expect(screen.getByText('setup.openAssistantButton')).toBeInTheDocument();
		const setupPanel = container.querySelector('#site-studio-panel-setup');
		if (!setupPanel) {
			throw new Error('Expected setup panel to render');
		}
		expect(
			within(setupPanel as HTMLElement).getByText('journey.cockpitLabel')
		).toBeInTheDocument();

		fireEvent.click(screen.getByText('tabs.ai'));
		expect(await screen.findByText('assistant.panelTitle')).toBeInTheDocument();
		expect(screen.getByText('assistant.panelDescription')).toBeInTheDocument();
		expect(screen.getByText('assistant.quickActionsTitle')).toBeInTheDocument();
		expect(screen.getByText('assistant.blueprintTitle')).toBeInTheDocument();

		expect(container.textContent ?? '').not.toMatch(
			rawTechnicalSetupCopyPattern
		);
	});

	it('keeps route guidance inside stage scroll containers and tools', async () => {
		mockedGetInstance.mockResolvedValue(instance);
		const { container } = render(<UserSiteStudioApp />);

		await screen.findByText('Demo Site');

		const expectPanelGuidance = (selector: string) => {
			const panel = container.querySelector(selector);
			if (!panel) {
				throw new Error(`Expected ${selector} to render`);
			}
			expect(
				within(panel as HTMLElement).getByText('journey.cockpitLabel')
			).toBeInTheDocument();
		};

		const stageNav = screen.getByTestId('site-studio-stage-nav');
		expect(stageNav).toBeInTheDocument();
		expectPanelGuidance('#site-studio-panel-setup');

		fireEvent.click(within(stageNav).getByText('journey.steps.aiFill.title'));
		expectPanelGuidance('#site-studio-panel-autofill');

		fireEvent.click(screen.getByText('tabs.ai'));
		expectPanelGuidance('#site-studio-panel-ai');

		fireEvent.click(within(stageNav).getByText('journey.steps.review.title'));
		expectPanelGuidance('#site-studio-panel-content');

		fireEvent.click(within(stageNav).getByText('journey.steps.media.title'));
		expectPanelGuidance('#site-studio-panel-media');
	});

	it('keeps the auto-fill tab label user-facing in locales', () => {
		expect(ruSiteStudio.tabs.autofill).toBe('Автозаполнение');
		expect(enSiteStudio.tabs.autofill).toBe('Auto-fill');
		expect(ruSiteStudio.tabs.autofill).not.toMatch(/ImperorG/i);
		expect(enSiteStudio.tabs.autofill).not.toMatch(/ImperorG/i);
	});

	it('keeps first-run copy localized in both supported locales', () => {
		expect(ruSiteStudio.setup.firstRun.createButton).toBe('Создать сайт');
		expect(enSiteStudio.setup.firstRun.createButton).toBe('Create site');
		expect(ruSiteStudio.setup.firstRun.title).not.toBe(
			enSiteStudio.setup.firstRun.title
		);
		expect(
			[
				ruSiteStudio.setup.firstRun.title,
				ruSiteStudio.setup.firstRun.description,
				enSiteStudio.setup.firstRun.title,
				enSiteStudio.setup.firstRun.description,
			].join(' | ')
		).not.toMatch(/workspace|runtime|Brief|ImperorG/u);
	});

	it('keeps draft and media review copy localized in both supported locales', () => {
		expect(ruSiteStudio.draftReview.contentEyebrow).toBe('Черновик текста');
		expect(enSiteStudio.draftReview.contentEyebrow).toBe('Text draft');
		expect(ruSiteStudio.media.imageEyebrow).toBe('Черновик изображения');
		expect(enSiteStudio.media.imageEyebrow).toBe('Image draft');
		expect(
			[
				enSiteStudio.draftReview.panelTitle,
				enSiteStudio.draftReview.applyContent,
				enSiteStudio.draftReview.keywordsLabel,
				enSiteStudio.media.panelTitle,
				enSiteStudio.media.generateButton,
				enSiteStudio.media.promptTitle,
			].join(' | ')
		).not.toMatch(/[А-Яа-яЁё]/u);
	});

	it('keeps assistant and blueprint workspace copy localized in both supported locales', () => {
		expect(ruSiteStudio.assistant.quickActionsTitle).toBe('Быстрые действия');
		expect(enSiteStudio.assistant.quickActionsTitle).toBe('Quick actions');
		expect(ruSiteStudio.assistant.blueprint.brandCore).toBe('Суть бренда');
		expect(enSiteStudio.assistant.blueprint.brandCore).toBe('Brand core');
		expect(
			[
				enSiteStudio.assistant.roleAssistant,
				enSiteStudio.assistant.quickActionsTitle,
				enSiteStudio.assistant.refreshBlueprint,
				enSiteStudio.assistant.generateSeo,
				enSiteStudio.assistant.blueprintTitle,
				enSiteStudio.assistant.blueprint.empty,
				enSiteStudio.assistant.progress.blueprint,
				enSiteStudio.app.professionalWorldsDraftAdded,
			].join(' | ')
		).not.toMatch(/[А-Яа-яЁё]/u);
	});

	it('shows stale banner when refresh fails after instance was loaded', async () => {
		let failRefresh = false;
		mockedGetInstance.mockImplementation(async () => {
			if (!failRefresh) return instance;
			throw new Error('network unavailable');
		});
		render(<UserSiteStudioApp />);

		await screen.findByText('Demo Site');
		expect(screen.queryByText('app.staleTitle')).not.toBeInTheDocument();

		failRefresh = true;
		fireEvent.click(screen.getByLabelText('header.refreshAria'));

		expect(await screen.findByText('app.staleTitle')).toBeInTheDocument();
		expect(screen.getByText('app.staleDescription')).toBeInTheDocument();
		expect(screen.getByText('app.staleRetry')).toBeInTheDocument();
		expect(screen.getByText('Demo Site')).toBeInTheDocument();
	});
});
