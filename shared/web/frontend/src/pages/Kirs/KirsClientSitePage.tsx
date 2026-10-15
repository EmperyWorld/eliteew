/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-facing KIRS site handoff surface with storefront/admin access and approval actions.
 *
 * Invariants:
 * - Client context excludes operator diagnostics such as worker, jobs and DNS internals.
 * - Approval actions update KIRS project site handoff state through authenticated backend routes.
 *
 * Related:
 * - `features/kirs/kirsApi.ts`
 * - `api/routers/kirs.py`
 */
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
	DesktopAppToolbar,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	getKirsClientSiteContext,
	updateKirsClientSiteApproval,
} from '@/features/kirs/kirsApi';
import { marketingCabinetApi } from '@/pages/MarketingCabinet/marketingCabinetApi';
import { cn } from '@/utils/cn';
import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import {
	KIRS_CLIENT_SITE_GUIDE_AUDIO_LS_KEY,
	KIRS_CLIENT_SITE_GUIDE_ROOT_ID,
	KIRS_CLIENT_SITE_GUIDE_STEP_DEFS,
	KIRS_CLIENT_SITE_GUIDE_TOUR_FOLDER,
} from './kirsClientSiteGuideConstants';
import {
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	ArrowsPointingOutIcon,
	Bars3BottomLeftIcon,
	GlobeAltIcon,
	ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const KIRS_CLIENT_KEY = ['kirs-client-site'] as const;

const KirsSiteStudioAdminPanelLazy = React.lazy(
	() => import('./KirsSiteStudioAdminPanel')
);

export const KirsClientSitePage: React.FC = () => {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'kirsClientSite' });
	const guideLabels = React.useMemo(
		() => guideTourLabelsFromI18n(t, 'guide'),
		[t]
	);
	const guideSteps = useBuiltGuideSteps(
		t,
		'guide.steps',
		KIRS_CLIENT_SITE_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = React.useState(false);
	const openGuideTour = React.useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour);
	const companiesQuery = useQuery({
		queryKey: [...KIRS_CLIENT_KEY, 'companies'],
		queryFn: () =>
			marketingCabinetApi.listCompanies({ as_representative: true }),
	});

	const companies = companiesQuery.data ?? [];
	const projectQueries = useQueries({
		queries: companies.map((c) => ({
			queryKey: [...KIRS_CLIENT_KEY, 'projects', c.id] as const,
			queryFn: () => marketingCabinetApi.listProjects(c.id),
			enabled: companiesQuery.isSuccess && companies.length > 0,
		})),
	});

	const flatProjectRows = companies.flatMap((c, idx) =>
		(projectQueries[idx]?.data ?? []).map((project) => ({
			companyId: c.id,
			companyName: c.name,
			project,
		}))
	);

	const [openProjectId, setOpenProjectId] = React.useState<string | null>(null);
	const [clientTab, setClientTab] = React.useState<'storefront' | 'admin'>(
		'storefront'
	);
	const [clientFeedback, setClientFeedback] = React.useState('');
	/** Админка на всю область окна приложения (без шапки и списка проектов). */
	const [adminImmersive, setAdminImmersive] = React.useState(false);

	const prepareGuideStep = React.useCallback(
		(stepId: string) => {
			if (
				stepId === 'intro' ||
				stepId === 'header' ||
				stepId === 'project-list' ||
				stepId === 'outro'
			) {
				return;
			}
			if (!openProjectId && flatProjectRows.length > 0) {
				setOpenProjectId(flatProjectRows[0].project.id);
			}
			if (
				stepId === 'storefront' ||
				stepId === 'view-tabs' ||
				stepId === 'next-step' ||
				stepId === 'readiness' ||
				stepId === 'approval'
			) {
				setClientTab('storefront');
			}
		},
		[flatProjectRows, openProjectId]
	);

	React.useEffect(() => {
		setClientTab('storefront');
	}, []);

	React.useEffect(() => {
		if (clientTab !== 'admin') {
			setAdminImmersive(false);
		}
	}, [clientTab]);

	React.useEffect(() => {
		setAdminImmersive(false);
	}, []);

	const siteCtxQuery = useQuery({
		queryKey: [...KIRS_CLIENT_KEY, 'ctx', openProjectId],
		queryFn: () => {
			if (!openProjectId) throw new Error('Kirs client: project id required');
			return getKirsClientSiteContext(openProjectId);
		},
		enabled: Boolean(openProjectId),
	});

	const ctx = siteCtxQuery.data;
	React.useEffect(() => {
		setClientFeedback(ctx?.client_feedback ?? '');
	}, [ctx?.client_feedback]);

	const approvalMut = useMutation({
		mutationFn: (action: 'approve' | 'request_changes') => {
			if (!openProjectId) throw new Error('Kirs client: project id required');
			return updateKirsClientSiteApproval(openProjectId, {
				action,
				message: clientFeedback.trim() || null,
			});
		},
		onSuccess: () => {
			void siteCtxQuery.refetch();
		},
	});

	const canStorefront = Boolean(ctx?.public_url);
	const canAdmin = Boolean(ctx?.admin_embed_available);
	const adminRuntimeReady = ctx?.status === 'running';
	const clientNextAction = React.useMemo(() => {
		if (!ctx?.has_instance) return null;
		if (!canStorefront && !canAdmin) {
			return {
				title: 'Доступ ещё не открыт',
				description:
					'Куратор должен включить витрину или админку. Пока действий от клиента не требуется.',
				tone: 'warn',
			};
		}
		if (canAdmin && !adminRuntimeReady) {
			return {
				title: 'Сайт запускается',
				description:
					'Дождитесь, когда куратор завершит запуск. После этого админка станет доступна здесь.',
				tone: 'info',
			};
		}
		if (canStorefront && ctx.approval_status !== 'approved') {
			return {
				title: 'Проверьте витрину',
				description:
					'Откройте сайт, оставьте комментарий для куратора или одобрите результат.',
				tone: 'info',
			};
		}
		return {
			title: 'Сайт согласован',
			description:
				'Витрина одобрена. Можно продолжить полировку в админке или открыть публичный сайт.',
			tone: 'ok',
		};
	}, [
		adminRuntimeReady,
		canAdmin,
		canStorefront,
		ctx?.approval_status,
		ctx?.has_instance,
	]);

	const showAdminImmersive =
		adminImmersive &&
		clientTab === 'admin' &&
		Boolean(openProjectId) &&
		Boolean(ctx?.has_instance) &&
		canAdmin &&
		adminRuntimeReady;

	if (showAdminImmersive && openProjectId && ctx) {
		return (
			<div
				className={cn(
					DESKTOP_APP_STYLE_CONTRACT.shell,
					'flex h-full min-h-0 flex-col overflow-hidden'
				)}
			>
				<div className="flex shrink-0 items-center gap-2 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/90 px-2 py-1.5">
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						onClick={() => setAdminImmersive(false)}
						className="min-h-9"
					>
						<Bars3BottomLeftIcon className="size-4" aria-hidden />
						Показать панель
					</DesktopAppButton>
					<span className="truncate text-xs text-(--desktop-text-muted)">
						Админка сайта — полный экран приложения
					</span>
				</div>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
					<React.Suspense
						fallback={
							<div className="flex flex-1 items-center justify-center py-16">
								<ArrowPathIcon className="size-8 animate-spin text-(--desktop-text-muted)" />
							</div>
						}
					>
						<KirsSiteStudioAdminPanelLazy
							projectId={openProjectId}
							publicSiteUrl={ctx.public_url}
						/>
					</React.Suspense>
				</div>
			</div>
		);
	}

	return (
		<div
			id={KIRS_CLIENT_SITE_GUIDE_ROOT_ID}
			className={cn(
				DESKTOP_APP_STYLE_CONTRACT.shell,
				'flex h-full min-h-0 flex-col gap-3 p-3 sm:p-4'
			)}
		>
			<DesktopAppToolbar
				data-kirs-client-site-guide="header"
				className="shrink-0 items-center justify-between gap-2"
			>
				<div className="flex min-w-0 items-center gap-2">
					<GlobeAltIcon
						className="size-5 shrink-0 text-slate-300"
						aria-hidden
					/>
					<div className="min-w-0">
						<div className="truncate text-sm font-semibold text-(--desktop-text-primary)">
							Мой сайт
						</div>
						<div className="truncate text-xs text-(--desktop-text-muted)">
							Доступ к витрине по настройкам КИРС
						</div>
					</div>
				</div>
				<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => void companiesQuery.refetch()}
						disabled={companiesQuery.isFetching}
					>
						<ArrowPathIcon
							className={cn(
								'size-4',
								companiesQuery.isFetching && 'animate-spin'
							)}
							aria-hidden
						/>
						Обновить
					</DesktopAppButton>
				</div>
			</DesktopAppToolbar>

			<div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,280px)_1fr]">
				<DesktopAppSurface
					data-kirs-client-site-guide="project-list"
					variant="soft"
					className="flex min-h-0 flex-col overflow-hidden p-2"
				>
					<DesktopAppSectionLabel className="px-1">
						Проекты
					</DesktopAppSectionLabel>
					<div className="mt-2 min-h-0 flex-1 overflow-y-auto">
						{companiesQuery.isLoading ? (
							<div className="flex justify-center py-8">
								<ArrowPathIcon className="size-6 animate-spin text-(--desktop-text-muted)" />
							</div>
						) : flatProjectRows.length === 0 ? (
							<DesktopAppEmptyState
								title="Нет проектов"
								description="Как представитель заказчика выберите компанию в маркетинговом кабинете."
							/>
						) : (
							<ul className="space-y-1">
								{flatProjectRows.map(({ project, companyName }) => {
									const active = openProjectId === project.id;
									return (
										<li key={project.id}>
											<button
												type="button"
												onClick={() => setOpenProjectId(project.id)}
												className={cn(
													'w-full rounded-lg px-2 py-2 text-left text-sm transition-colors',
													active
														? 'bg-slate-700/80 text-slate-100'
														: 'hover:bg-slate-700/50 text-slate-300'
												)}
											>
												<div className="truncate font-medium">
													{project.name}
												</div>
												<div className="truncate text-xs text-(--desktop-text-muted)">
													{companyName}
												</div>
											</button>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</DesktopAppSurface>

				<DesktopAppSurface
					variant="soft"
					className="flex min-h-0 flex-col overflow-hidden p-2"
				>
					{!openProjectId ? (
						<DesktopAppEmptyState
							title="Выберите проект"
							description="Здесь отображается сайт, если агентство выдало доступ в КИРС."
						/>
					) : siteCtxQuery.isLoading ? (
						<div className="flex flex-1 items-center justify-center py-16">
							<ArrowPathIcon className="size-8 animate-spin text-(--desktop-text-muted)" />
						</div>
					) : !ctx?.has_instance ? (
						<DesktopAppEmptyState
							title="Сайт ещё не подключён"
							description="Когда куратор создаст инстанс в КИРС, витрина появится здесь."
						/>
					) : !canStorefront && !canAdmin ? (
						<DesktopAppEmptyState
							title="Доступ не выдан"
							description="Попросите агентство включить витрину и/или админку в настройках КИРС."
						/>
					) : (
						<div className="flex h-full min-h-0 flex-col gap-2">
							{canStorefront && canAdmin ? (
								<div
									data-kirs-client-site-guide="view-tabs"
									className="flex shrink-0 flex-wrap items-center gap-2"
								>
									<DesktopAppButton
										type="button"
										size="sm"
										variant="ghost"
										active={clientTab === 'storefront'}
										onClick={() => setClientTab('storefront')}
									>
										<GlobeAltIcon className="size-4" aria-hidden />
										Витрина
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										size="sm"
										variant="ghost"
										active={clientTab === 'admin'}
										onClick={() => setClientTab('admin')}
									>
										<ShieldCheckIcon className="size-4" aria-hidden />
										Админка
									</DesktopAppButton>
									{clientTab === 'admin' && adminRuntimeReady ? (
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											onClick={() => setAdminImmersive(true)}
											title="Скрыть список проектов и шапку — админка на весь экран приложения"
										>
											<ArrowsPointingOutIcon className="size-4" aria-hidden />
											На весь экран
										</DesktopAppButton>
									) : null}
								</div>
							) : null}

							{clientNextAction ? (
								<DesktopAppSurface
									data-kirs-client-site-guide="next-step"
									variant="soft"
									className={cn(
										'shrink-0 border p-3',
										clientNextAction.tone === 'ok'
											? 'border-emerald-400/25 bg-emerald-500/10'
											: clientNextAction.tone === 'warn'
												? 'border-amber-400/25 bg-amber-500/10'
												: 'border-sky-400/25 bg-sky-500/10'
									)}
								>
									<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
										Следующий шаг
									</div>
									<div className="mt-1 text-sm font-medium text-(--desktop-text-primary)">
										{clientNextAction.title}
									</div>
									<p className="mt-1 text-sm leading-6 text-(--desktop-text-secondary)">
										{clientNextAction.description}
									</p>
								</DesktopAppSurface>
							) : null}

							<DesktopAppSurface
								data-kirs-client-site-guide="readiness"
								variant="soft"
								className="shrink-0 p-3"
							>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
											Готовность
										</div>
										<div className="mt-1 text-sm text-(--desktop-text-secondary)">
											{ctx.readiness_status} · {ctx.approval_status}
										</div>
									</div>
									<div
										data-kirs-client-site-guide="approval"
										className="flex flex-wrap gap-2"
									>
										<DesktopAppButton
											type="button"
											size="sm"
											variant="accent"
											disabled={approvalMut.isPending}
											onClick={() => approvalMut.mutate('approve')}
										>
											Одобрить
										</DesktopAppButton>
									</div>
								</div>
								<textarea
									value={clientFeedback}
									onChange={(event) => setClientFeedback(event.target.value)}
									placeholder="Комментарий клиентской стороны для куратора"
									className="mt-3 min-h-16 w-full rounded-md border border-(--desktop-border) bg-(--desktop-surface) px-3 py-2 text-sm text-(--desktop-text-primary) outline-none placeholder:text-(--desktop-text-muted)"
								/>
							</DesktopAppSurface>

							{clientTab === 'admin' && canAdmin ? (
								adminRuntimeReady && openProjectId ? (
									<React.Suspense
										fallback={
											<div className="flex flex-1 items-center justify-center py-16">
												<ArrowPathIcon className="size-8 animate-spin text-(--desktop-text-muted)" />
											</div>
										}
									>
										<KirsSiteStudioAdminPanelLazy
											projectId={openProjectId}
											publicSiteUrl={ctx.public_url}
										/>
									</React.Suspense>
								) : (
									<DesktopAppEmptyState
										title="Админка скоро будет доступна"
										description="Дождитесь запуска сайта (статус running в КИРС)."
									/>
								)
							) : canStorefront && ctx.public_url ? (
								<>
									<div className="flex shrink-0 items-center gap-2">
										<a
											href={ctx.public_url}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1 text-sm text-sky-300 hover:underline"
										>
											<ArrowTopRightOnSquareIcon className="size-4" />
											Открыть в новой вкладке
										</a>
									</div>
									<div
										data-kirs-client-site-guide="storefront"
										data-desktop-iframe-host=""
										className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-(--desktop-border) bg-black/20"
									>
										<iframe
											title="Сайт проекта"
											src={ctx.public_url}
											className="h-full w-full min-h-[320px] border-0"
											sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
										/>
									</div>
								</>
							) : canAdmin && openProjectId ? (
								adminRuntimeReady ? (
									<div className="flex h-full min-h-0 flex-col gap-2">
										<div className="flex shrink-0 justify-end">
											<DesktopAppButton
												type="button"
												size="sm"
												variant="ghost"
												onClick={() => setAdminImmersive(true)}
												title="Скрыть список проектов и шапку — админка на весь экран приложения"
											>
												<ArrowsPointingOutIcon className="size-4" aria-hidden />
												На весь экран
											</DesktopAppButton>
										</div>
										<div className="min-h-0 flex-1 overflow-hidden">
											<React.Suspense
												fallback={
													<div className="flex flex-1 items-center justify-center py-16">
														<ArrowPathIcon className="size-8 animate-spin text-(--desktop-text-muted)" />
													</div>
												}
											>
												<KirsSiteStudioAdminPanelLazy
													projectId={openProjectId}
													publicSiteUrl={ctx.public_url}
												/>
											</React.Suspense>
										</div>
									</div>
								) : (
									<DesktopAppEmptyState
										title="Админка скоро будет доступна"
										description="Дождитесь запуска сайта (статус running в КИРС)."
									/>
								)
							) : (
								<DesktopAppEmptyState
									title="Нет контента для отображения"
									description="Проверьте настройки доступа в КИРС."
								/>
							)}
						</div>
					)}
				</DesktopAppSurface>
			</div>
			<SpotlightGuideModal
				open={guideOpen}
				onClose={() => setGuideOpen(false)}
				rootId={KIRS_CLIENT_SITE_GUIDE_ROOT_ID}
				steps={guideSteps}
				audioLocalStorageKey={KIRS_CLIENT_SITE_GUIDE_AUDIO_LS_KEY}
				tourAudioFolder={KIRS_CLIENT_SITE_GUIDE_TOUR_FOLDER}
				labels={guideLabels}
				onPrepareStep={prepareGuideStep}
				spotlightLayoutKey={`${guideOpen}-${openProjectId ?? 'none'}-${clientTab}`}
				dialogTitleId="kirs-client-site-guide-title"
			/>
		</div>
	);
};

export default KirsClientSitePage;
