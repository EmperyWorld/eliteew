/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Site Studio runtime panel user-facing status labels.
 *
 * Invariants:
 * - Runtime cards translate machine status values before rendering.
 * - Background task and domain summaries keep machine ids out of the primary view.
 *
 * Related:
 * - ../components/SiteStudioRuntimePanel.tsx
 * - ../../../../i18n/locales/ru/siteStudio.json
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SiteStudioRuntimePanel } from '../components/SiteStudioRuntimePanel';
import {
	listSiteStudioDomainBindings,
	runSiteManagerPublishSmoke,
	type SiteStudioDomainBinding,
	type SiteStudioDraftState,
	type SiteStudioHealth,
	type SiteStudioInstance,
} from '../api';

const translations: Record<string, string> = {
	'runtime.title': 'Запуск сайта',
	'runtime.nextAdmin':
		'Сайт активен. Откройте управление внутри рабочего стола.',
	'runtime.readinessTitle': 'Готовность к запуску',
	'runtime.readinessDescription': 'Короткая сводка',
	'runtime.readinessDone': 'готово',
	'runtime.readinessNeedsWork': 'дальше',
	'runtime.readinessProgressSummary': '3 из 4 шагов запуска готово',
	'runtime.readinessNextStep': 'Следующий фокус: Контент.',
	'runtime.readinessAllReady': 'Все шаги готовы.',
	'runtime.readinessContent': 'Контент',
	'runtime.readinessContentReady': 'Контент готов',
	'runtime.readinessContentPending': 'Нужны структура, тексты и визуал',
	'runtime.readinessRuntime': 'Запуск',
	'runtime.readinessRuntimeReady': 'Сайт работает и готов к проверке.',
	'runtime.readinessRuntimePending': 'Сайт ещё нужно запустить',
	'runtime.readinessPublication': 'Публикация',
	'runtime.readinessPublicationReady': 'Публичная витрина открыта',
	'runtime.readinessPublicationPending': 'Публичный доступ закрыт',
	'runtime.readinessManagement': 'Управление',
	'runtime.readinessManagementReady': 'Управление доступно',
	'runtime.readinessManagementPending': 'Управление откроется позже',
	'runtime.metricRuntime': 'Запуск',
	'runtime.metricApi': 'Управление',
	'runtime.metricPublic': 'Витрина',
	'runtime.runtimeState.running': 'Работает',
	'runtime.runtimeState.stopped': 'Остановлен',
	'runtime.healthState.ready': 'готово',
	'runtime.healthState.offline': 'не готово',
	'runtime.userActionsTitle': 'Действия для запуска',
	'runtime.userActionsDescription': 'Основной путь',
	'runtime.actionProvision': 'Подготовить сайт',
	'runtime.actionProvisionTooltip': 'Подготовит сайт',
	'runtime.actionStart': 'Запустить сайт',
	'runtime.actionStartTooltip': 'Запускает сайт',
	'runtime.actionOpenSite': 'Открыть сайт для посетителей',
	'runtime.actionOpenSiteTooltip': 'Открывает сайт',
	'runtime.actionCloseSite': 'Закрыть сайт',
	'runtime.actionCloseSiteTooltip': 'Закрывает сайт',
	'runtime.openStorefront': 'Открыть публичную витрину',
	'runtime.openStorefrontTooltip': 'Открывает витрину',
	'runtime.openAdmin': 'Открыть управление',
	'runtime.openAdminTooltip': 'Открывает управление',
	'runtime.advancedActionsTitle': 'Дополнительные действия поддержки',
	'runtime.actionStop': 'Поставить на паузу',
	'runtime.actionStopTooltip': 'Ставит на паузу',
	'runtime.actionRedeploy': 'Обновить сайт',
	'runtime.actionRedeployTooltip': 'Обновляет сайт',
	'runtime.lifecycleDiagnosticsTitle': 'Фоновые задачи',
	'runtime.lifecycleWorker': 'Исполнитель',
	'runtime.lifecycleWorkerReady': 'готов',
	'runtime.lifecycleWorkerOffline': 'нет свежего сигнала',
	'runtime.lifecycleWorkerSeen': 'последний сигнал 3 сек. назад',
	'runtime.lifecyclePendingJob': 'Текущая задача',
	'runtime.lifecycleLastJob': 'Последняя задача',
	'runtime.lifecycleNoLastJob': 'задач ещё не было',
	'runtime.lifecycleJobActiveHint': 'Фоновая задача выполняется.',
	'runtime.lifecycleTaskType.start': 'Запуск сайта',
	'runtime.lifecycleJobStatus.running': 'выполняется',
	'runtime.lifecycleJobStatus.finished': 'завершена',
	'runtime.lifecycleJobStage.health': 'проверка',
	'runtime.opsTitle': 'Операторский контроль',
	'runtime.opsDescription': 'Сводка по фоновому исполнителю',
	'runtime.opsRefresh': 'Обновить сводку',
	'runtime.opsSmoke': 'Проверить публикацию',
	'runtime.opsWorker': 'Фоновый исполнитель',
	'runtime.opsJobs': 'Задачи',
	'runtime.opsDomains': 'Домены',
	'runtime.opsReconcile': 'Сверка состояния',
	'runtime.opsSmokeResult': 'Проверка: пройдена, критичных ошибок: 0',
	'runtime.opsSmokeResultReady':
		'Витрина отвечает, публичная админка закрыта, базовые файлы и SEO-поля на месте. Можно открывать сайт для посетителей.',
	'runtime.opsSmokeResultAttention':
		'Проверка нашла проблемы в live-витрине. Откройте детали ниже и исправьте критичные пункты перед публикацией.',
	'runtime.smokeStatus.passed': 'пройдена',
	'runtime.domainsTitle': 'Внутренний домен',
	'runtime.domainsDescription': 'Привяжите домен',
	'runtime.domainsPlaceholder': 'site.example.com',
	'runtime.domainsAdd': 'Добавить домен',
	'runtime.domainsVerify': 'Проверить TXT',
	'runtime.domainsRequestRoute': 'Запросить маршрут',
	'runtime.domainsActivate': 'Активировать',
	'runtime.domainsDisable': 'Отключить',
	'runtime.domainsTxtName': 'TXT имя',
	'runtime.domainsTxtValue': 'TXT значение',
	'runtime.domainsProgressAria': 'Прогресс домена custom.example.com',
	'runtime.domainsStepTxt': 'TXT',
	'runtime.domainsStepRoute': 'Маршрут',
	'runtime.domainsStepTls': 'TLS',
	'runtime.domainsStepActive': 'Активен',
	'runtime.domainsStepStatus.done': 'готово',
	'runtime.domainsStepStatus.current': 'сейчас',
	'runtime.domainsStepStatus.next': 'дальше',
	'runtime.domainBindingStatus.route_pending': 'маршрут ожидает',
	'runtime.domainTlsStatus.pending': 'ожидает',
	'runtime.copy': 'Скопировать',
	'runtime.notReady': 'Пока не готово',
	'runtime.fieldHost': 'Адрес сайта',
	'runtime.fieldPublicUrl': 'Ссылка витрины',
	'runtime.fieldApiUrl': 'Служебная ссылка',
	'runtime.fieldEdgeUrl': 'Ссылка Edge (LAN)',
	'runtime.openEdgeUrl': 'Открыть Edge-ссылку',
	'runtime.openEdgeVisitor': 'Открыть Edge для посетителей',
	'runtime.openEdgeVisitorTooltip':
		'Открывает LAN Edge-ссылку только когда опубликован живой пакет.',
	'runtime.edgeLastError': 'Проблема публикации на Edge: {{message}}',
	'runtime.edgeStateLive': 'Edge для посетителей: доступен',
	'runtime.edgeStateNeedsAttention': 'Edge для посетителей: нужна проверка',
	'runtime.edgeStateIdle': 'Edge: ожидает публикации',
	'runtime.edgeNeedsAttentionHint':
		'Сайт открыт в CMS, но посетительская Edge-ссылка ещё не готова.',
	'runtime.readinessEdgeLiveReady':
		'Посетители могут открыть сайт по LAN Edge-ссылке.',
	'runtime.readinessEdgeLivePending':
		'Edge для посетителей ещё не готов (нужен живой пакет, не черновой предпросмотр).',
	'runtime.edgeContentSource.runtime_dist': 'Живой пакет сайта с хоста запуска',
	'runtime.edgeContentSource.snapshot': 'Снимок витрины',
	'runtime.edgeContentSource.stub':
		'Черновой пакет предпросмотра (полная витрина пока недоступна)',
	'runtime.disabledActionsTitle': 'Почему часть действий недоступна',
	'runtime.disabledActionsGroupedCountLabel': 'Причин',
	'runtime.disabledActionsHiddenCountLabel': 'Скрыто',
	'runtime.disabledActionsDetailsCountLabel': 'Строк',
	'runtime.disabledActionsSummaryScrollHint': 'Прокрутите',
	'runtime.disabledActionsDetailsTitle': 'Подробно по действиям',
	'runtime.disabledActionsShowDetails': 'Показать подробный список',
	'runtime.disabledActionsHideDetails': 'Скрыть подробный список',
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) => {
			if (key === 'runtime.domainTlsState') {
				return `TLS: ${String(params?.state ?? '')}`;
			}
			if (key === 'runtime.lastError') {
				return `Последняя ошибка: ${String(params?.message ?? '')}`;
			}
			if (
				key.endsWith('_one') ||
				key.endsWith('_few') ||
				key.endsWith('_many')
			) {
				return translations[key.replace(/_(one|few|many)$/u, '')] ?? key;
			}
			return translations[key] ?? String(params?.defaultValue ?? key);
		},
		i18n: { language: 'ru' },
	}),
}));

vi.mock('../api', () => ({
	activateSiteStudioDomainBinding: vi.fn(),
	createSiteStudioDomainBinding: vi.fn(),
	disableSiteStudioDomainBinding: vi.fn(),
	getSiteManagerOpsOverview: vi.fn(),
	listSiteStudioDomainBindings: vi.fn(),
	requestSiteStudioDomainRoute: vi.fn(),
	runSiteManagerPublishSmoke: vi.fn(),
	verifySiteStudioDomainBinding: vi.fn(),
}));

const mockedListDomains = vi.mocked(listSiteStudioDomainBindings);
const mockedPublishSmoke = vi.mocked(runSiteManagerPublishSmoke);

const instance: SiteStudioInstance = {
	id: 'site-1',
	user_id: 'user-1',
	template_key: 'olenti',
	site_slug: 'demo-site',
	site_title: 'Demo Site',
	site_topic: 'Demo topic',
	brief_json: {},
	status: 'running',
	public_hostname: 'demo.sites.eliteew.ru',
	publication_state: 'open',
	public_url: 'https://demo.sites.eliteew.ru',
	api_base_url: 'http://demo-api',
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

const health: SiteStudioHealth = {
	status: 'running',
	api_ok: true,
	public_ok: true,
	api_error: null,
	public_error: null,
	ports: {},
	public_hostname: 'demo.sites.eliteew.ru',
	publication_state: 'open',
	public_url: 'https://demo.sites.eliteew.ru',
	api_base_url: 'http://demo-api',
	worker_ready: true,
	worker_id: 'worker-1',
	worker_last_seen_at: '2026-05-29T00:00:00Z',
	worker_last_seen_age_seconds: 3,
	worker_ready_window_seconds: 180,
	pending_job: {
		id: 'job-raw-id',
		instance_scope: 'user',
		instance_id: 'site-1',
		site_slug: 'demo-site',
		task_type: 'site_studio_start',
		status: 'running',
		stage: 'health',
		queued: true,
		worker_id: 'worker-1',
		attempts: 1,
		last_error: null,
		metadata_json: {},
		created_at: '2026-05-29T00:00:00Z',
		queued_at: '2026-05-29T00:00:00Z',
		started_at: '2026-05-29T00:00:00Z',
		finished_at: null,
		updated_at: '2026-05-29T00:00:00Z',
		duration_ms: null,
	},
	last_job: null,
};

const drafts: SiteStudioDraftState = {
	brief: 'Demo',
	siteBlueprint: { offer: 'Demo' },
	assistantMessages: [],
	contentDrafts: [],
	seoDrafts: [],
	imageDrafts: [],
};

const domain: SiteStudioDomainBinding = {
	id: 'domain-1',
	instance_scope: 'user',
	instance_id: 'site-1',
	hostname: 'custom.example.com',
	status: 'route_pending',
	verification_method: 'dns_txt',
	verification_name: '_eliteew-site.custom.example.com',
	verification_token_preview: 'token',
	expected_cname: 'sites.eliteew.ru',
	verified_at: null,
	last_checked_at: null,
	route_ready_at: null,
	tls_status: 'pending',
	last_error: null,
	metadata_json: {},
	created_at: '2026-05-29T00:00:00Z',
	updated_at: '2026-05-29T00:00:00Z',
};

describe('SiteStudioRuntimePanel copy', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedListDomains.mockResolvedValue([domain]);
		mockedPublishSmoke.mockResolvedValue({
			instance_scope: 'user',
			instance_id: 'site-1',
			status: 'passed',
			checks: [],
			hard_failure_count: 0,
			generated_at: '2026-05-29T00:00:00Z',
		});
	});

	it('renders user-facing runtime, task, and domain statuses', async () => {
		mockedListDomains.mockResolvedValueOnce([
			{ ...domain, last_error: 'route failed' },
		]);
		const healthWithLastJobError: SiteStudioHealth = {
			...health,
			last_job: {
				...(health.pending_job as NonNullable<SiteStudioHealth['pending_job']>),
				id: 'job-failed',
				status: 'finished',
				last_error: 'health failed',
			},
		};
		const { container } = render(
			<SiteStudioRuntimePanel
				instance={instance}
				health={healthWithLastJobError}
				drafts={drafts}
				canOpenAdminShell
				busyKeys={new Set()}
				onRunAction={vi.fn()}
				onOpenPublic={vi.fn()}
				onOpenAdmin={vi.fn()}
				onCopy={vi.fn()}
			/>
		);

		expect(screen.getByText('Работает')).toBeInTheDocument();
		expect(screen.getByText('Готовность к запуску')).toBeInTheDocument();
		expect(screen.getByText('3 из 4 шагов запуска готово')).toBeInTheDocument();
		expect(screen.getByText('Следующий фокус: Контент.')).toBeInTheDocument();
		expect(
			screen.getByText('Нужны структура, тексты и визуал')
		).toBeInTheDocument();
		expect(
			screen.getByText('Сайт работает и готов к проверке.')
		).toBeInTheDocument();
		expect(screen.getByText('Публичная витрина открыта')).toBeInTheDocument();
		expect(screen.getByText('Управление доступно')).toBeInTheDocument();
		expect(screen.getAllByText('готов').length).toBeGreaterThan(0);
		expect(
			screen.getByText('Запуск сайта · выполняется · проверка')
		).toBeInTheDocument();
		expect(screen.getByText('Фоновая задача выполняется.')).toBeInTheDocument();
		expect(
			await screen.findByText('маршрут ожидает · TLS: ожидает')
		).toBeInTheDocument();
		expect(await screen.findByText('TXT')).toBeInTheDocument();
		expect(screen.getByText('Маршрут')).toBeInTheDocument();
		expect(screen.getByText('TLS')).toBeInTheDocument();
		expect(screen.getByText('Активен')).toBeInTheDocument();
		expect(screen.getByText('сейчас')).toBeInTheDocument();
		expect(screen.getByText('Адрес сайта')).toBeInTheDocument();
		expect(screen.getByText('Ссылка витрины')).toBeInTheDocument();
		expect(screen.getByText('Служебная ссылка')).toBeInTheDocument();
		expect(
			screen.getByText('Последняя ошибка: health failed')
		).toBeInTheDocument();
		expect(
			await screen.findByText('Последняя ошибка: route failed')
		).toBeInTheDocument();

		expect(container.textContent ?? '').not.toMatch(
			/\brunning\b|job:|route_pending|tls pending|Hostname|Public URL|API URL/u
		);
	});

	it('runs the same live publish smoke path as Site Manager', async () => {
		render(
			<SiteStudioRuntimePanel
				instance={instance}
				health={health}
				drafts={drafts}
				canOpenAdminShell
				busyKeys={new Set()}
				onRunAction={vi.fn()}
				onOpenPublic={vi.fn()}
				onOpenAdmin={vi.fn()}
				onCopy={vi.fn()}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'Проверить публикацию' })
		);

		await waitFor(() => {
			expect(mockedPublishSmoke).toHaveBeenCalledWith({
				instance_scope: 'user',
				instance_id: 'site-1',
				run_live: true,
			});
		});
		expect(
			await screen.findByText(
				'Витрина отвечает, публичная админка закрыта, базовые файлы и SEO-поля на месте. Можно открывать сайт для посетителей.'
			)
		).toBeInTheDocument();
		expect(screen.getByRole('status')).toHaveTextContent(
			'Проверка: пройдена, критичных ошибок: 0'
		);
	});

	it('labels domain loading failures as runtime errors', async () => {
		mockedListDomains.mockRejectedValueOnce(new Error('domains offline'));

		render(
			<SiteStudioRuntimePanel
				instance={instance}
				health={health}
				drafts={drafts}
				canOpenAdminShell
				busyKeys={new Set()}
				onRunAction={vi.fn()}
				onOpenPublic={vi.fn()}
				onOpenAdmin={vi.fn()}
				onCopy={vi.fn()}
			/>
		);

		expect(
			await screen.findByText('Последняя ошибка: domains offline')
		).toBeInTheDocument();
	});

	it('hides visitor Edge link for stub and shows needs-attention', async () => {
		const healthWithEdge: SiteStudioHealth = {
			...health,
			edge: {
				enabled: true,
				ssh_configured: true,
				port: 8087,
				url: 'http://192.168.1.10:8087',
				last_error: null,
				deployed_at: '2026-07-14T00:00:00',
				content_source: 'stub',
			},
		};

		render(
			<SiteStudioRuntimePanel
				instance={{ ...instance, publication_state: 'open' }}
				health={healthWithEdge}
				drafts={drafts}
				canOpenAdminShell
				busyKeys={new Set()}
				onRunAction={vi.fn()}
				onOpenPublic={vi.fn()}
				onOpenAdmin={vi.fn()}
				onCopy={vi.fn()}
			/>
		);

		expect(
			await screen.findByTestId('site-studio-edge-status')
		).toBeInTheDocument();
		expect(screen.getByText('Ссылка Edge (LAN)')).toBeInTheDocument();
		expect(
			screen.getByTestId('site-studio-edge-content-source')
		).toHaveTextContent(/черновой пакет предпросмотра/i);
		expect(screen.getByTestId('site-studio-edge-live-state')).toHaveTextContent(
			/нужна проверка/i
		);
		expect(
			screen.queryByRole('link', { name: 'http://192.168.1.10:8087' })
		).not.toBeInTheDocument();
		expect(screen.getByTestId('site-studio-open-visitor')).toBeDisabled();
	});

	it('shows visitor Edge link when content_source is runtime_dist', async () => {
		const healthWithEdge: SiteStudioHealth = {
			...health,
			edge: {
				enabled: true,
				ssh_configured: true,
				port: 8087,
				url: 'http://192.168.1.10:8087',
				last_error: null,
				deployed_at: '2026-07-14T00:00:00',
				content_source: 'runtime_dist',
			},
		};

		render(
			<SiteStudioRuntimePanel
				instance={{ ...instance, publication_state: 'open' }}
				health={healthWithEdge}
				drafts={drafts}
				canOpenAdminShell
				busyKeys={new Set()}
				onRunAction={vi.fn()}
				onOpenPublic={vi.fn()}
				onOpenAdmin={vi.fn()}
				onCopy={vi.fn()}
			/>
		);

		expect(
			await screen.findByRole('link', { name: 'http://192.168.1.10:8087' })
		).toHaveAttribute('href', 'http://192.168.1.10:8087');
		expect(screen.getByTestId('site-studio-edge-live-state')).toHaveTextContent(
			/доступен/i
		);
		expect(screen.getByTestId('site-studio-open-visitor')).not.toBeDisabled();
	});
});
