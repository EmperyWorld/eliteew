import {
	ArrowLeftIcon,
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	ChevronRightIcon,
	DocumentDuplicateIcon,
	LinkIcon,
	Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppToolbar,
} from '../../Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	getDesktopShellToolbarClusterClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import type { MarketingView } from '../constants';
import { MarketingAiJobCenter } from './MarketingAiJobCenter';
import { MarketingProjectGenerateAllAiButton } from './MarketingProjectGenerateAllAiButton';
import { MarketingWebSearchQualitySelect } from './MarketingWebSearchQualitySelect';
import {
	MarketingCabinetSelect,
	type MarketingCabinetSelectOption,
} from './MarketingCabinetSelect';

export interface MarketingCabinetToolbarProps {
	activeView: MarketingView;
	activeModuleTitle: string;
	selectedProjectId: string | null;
	selectedCompanyId: string | null;

	onCompanyChange: (id: string | null) => void;
	companySelectOptions: MarketingCabinetSelectOption[];
	companiesLoading: boolean;
	/** Ошибка загрузки списка компаний — селект отключён, повтор в баннере main. */
	companiesLoadFailed?: boolean;

	onProjectChange: (id: string | null) => void;
	projectSelectOptions: MarketingCabinetSelectOption[];
	projectsLoading: boolean;

	onContentChange: (id: string | null) => void;
	selectedContentId: string | null;
	contentSelectOptions: MarketingCabinetSelectOption[];
	contentLoading: boolean;
	contentEnabled: boolean;
	selectedContentMeta: string;
	onRefreshContent: () => void;
	onOpenContentManager: () => void;

	onJobCenterNavigate: (view: MarketingView, entityId?: string | null) => void;

	canCopyContextId: boolean;
	onCopyContextId: () => void | Promise<void>;
	onCopyPageLink: () => void | Promise<void>;
	onRefreshCabinet: () => void;

	/** Нет проектов у компании — блокируем селект проекта. */
	projectsEmpty: boolean;

	/** Массовый запуск «Сгенерировать с AI» по всем разделам (только при выбранном проекте). */
	allowMarketingWrite?: boolean;

	/** В режиме полноэкранного дашборда — «Назад» слева в полоске контекста. */
	dashboardPrimaryAction?: {
		label: string;
		ariaLabel: string;
		onClick: () => void;
	} | null;

	/** С обзора карточек — открыть полноэкранный дашборд (K.107 prefetch на hover/focus). */
	openInteractiveDashboardAction?: {
		label: string;
		ariaLabel: string;
		onClick: () => void;
		onPrefetch?: () => void;
	} | null;

	/** Подгрузить списки компаний/проектов в тулбаре (deferred fetch). */
	onFoundationContextEngage?: () => void;
	/** Подгрузить список документов проекта в тулбаре (deferred fetch). */
	onToolbarContentEngage?: () => void;
}

export function MarketingCabinetToolbar({
	activeView,
	activeModuleTitle,
	selectedProjectId,
	selectedCompanyId,
	onCompanyChange,
	companySelectOptions,
	companiesLoading,
	companiesLoadFailed = false,
	onProjectChange,
	projectSelectOptions,
	projectsLoading,
	onContentChange,
	selectedContentId,
	contentSelectOptions,
	contentLoading,
	contentEnabled,
	selectedContentMeta,
	onRefreshContent,
	onOpenContentManager,
	onJobCenterNavigate,
	canCopyContextId,
	onCopyContextId,
	onCopyPageLink,
	onRefreshCabinet,
	projectsEmpty,
	allowMarketingWrite = false,
	dashboardPrimaryAction = null,
	openInteractiveDashboardAction = null,
	onFoundationContextEngage,
	onToolbarContentEngage,
}: MarketingCabinetToolbarProps) {
	const { t } = useTranslation('marketing');
	const shellFrame = useDesktopShellFrame();
	const toolbarCluster = getDesktopShellToolbarClusterClassName(shellFrame);
	const toolbarInsetSurface =
		getDesktopShellToolbarClusterInsetControlClassName(shellFrame);

	const isDashboardBackMode = Boolean(dashboardPrimaryAction);
	const overviewDashboardCta = Boolean(openInteractiveDashboardAction);

	return (
		<DesktopAppToolbar
			data-mc-guide="toolbar"
			className={cn(
				'flex-col gap-0 border-b border-(--desktop-border-subtle)/80 bg-transparent backdrop-blur-md',
				isDashboardBackMode
					? 'px-2 py-1 sm:px-3 sm:py-1.5'
					: 'px-3 py-2 sm:px-4 sm:py-2.5',
				(isDashboardBackMode || overviewDashboardCta) &&
					'w-full min-w-0 max-w-full overflow-x-hidden'
			)}
		>
			<h1 id="marketing-cabinet-module-title" tabIndex={-1} className="sr-only">
				{activeModuleTitle}
			</h1>

			<div
				className={cn(
					'flex w-full min-w-0 max-w-full flex-col lg:flex-row lg:flex-wrap lg:items-center lg:justify-between',
					isDashboardBackMode
						? 'gap-1.5 pt-0 sm:gap-2 lg:gap-2'
						: 'gap-2 pt-1 sm:gap-2.5 sm:pt-2 lg:gap-3',
					!isDashboardBackMode && overviewDashboardCta && 'pt-1 sm:pt-1.5'
				)}
			>
				{isDashboardBackMode && dashboardPrimaryAction ? (
					<div className="flex min-w-0 shrink-0 flex-wrap items-center gap-1.5">
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="min-h-8 w-fit px-2.5 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-h-8 sm:px-3"
							aria-label={dashboardPrimaryAction.ariaLabel}
							onClick={dashboardPrimaryAction.onClick}
						>
							<ArrowLeftIcon
								className="h-3.5 w-3.5 shrink-0"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							{dashboardPrimaryAction.label}
						</DesktopAppButton>
					</div>
				) : openInteractiveDashboardAction ? (
					<div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">
						<DesktopAppButton
							type="button"
							variant="accent"
							size="md"
							className="min-h-10 w-fit max-w-full px-4 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-h-11 sm:px-5"
							aria-label={openInteractiveDashboardAction.ariaLabel}
							onClick={openInteractiveDashboardAction.onClick}
							onMouseEnter={() => openInteractiveDashboardAction.onPrefetch?.()}
							onFocus={() => openInteractiveDashboardAction.onPrefetch?.()}
						>
							<Squares2X2Icon
								className="h-4 w-4 shrink-0"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							<span className="min-w-0 truncate">
								{openInteractiveDashboardAction.label}
							</span>
						</DesktopAppButton>
					</div>
				) : null}
				<div
					className={cn(
						'flex min-w-0 flex-1 flex-wrap items-center rounded-(--desktop-radius-lg)',
						isDashboardBackMode
							? 'gap-x-1.5 gap-y-1 p-1 sm:p-1.5'
							: 'gap-x-2 gap-y-2 p-2',
						toolbarCluster,
						(isDashboardBackMode || overviewDashboardCta) &&
							'max-w-full overflow-x-auto overscroll-x-contain'
					)}
				>
					{/* Компания → проект */}
					<fieldset
						aria-label={t('toolbar.contextGroup')}
						className="m-0 min-w-0 flex flex-[1_1_100%] flex-wrap items-center gap-1.5 border-0 p-0 sm:flex-[1_1_auto] md:flex-nowrap xl:max-w-none"
						onMouseEnter={onFoundationContextEngage}
						onFocusCapture={onFoundationContextEngage}
					>
						<MarketingCabinetSelect
							embeddedInToolbarCluster
							className="min-w-0 flex-1 basis-[min(100%,11rem)] sm:min-w-32 xl:max-w-44"
							size="compact"
							value={selectedCompanyId ?? ''}
							onChange={(v) => onCompanyChange(v || null)}
							disabled={companiesLoading || companiesLoadFailed}
							aria-label={t('toolbar.ariaSelectCompany')}
							options={companySelectOptions}
							onOpen={onFoundationContextEngage}
						/>
						<div
							className="hidden shrink-0 items-center justify-center sm:flex"
							aria-hidden
						>
							<ChevronRightIcon
								className="h-3.5 w-3.5 text-(--desktop-text-dim) opacity-40"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</div>
						<MarketingCabinetSelect
							embeddedInToolbarCluster
							className="min-w-0 flex-1 basis-[min(100%,11rem)] sm:min-w-32 xl:max-w-44"
							size="compact"
							value={selectedProjectId ?? ''}
							onChange={(v) => onProjectChange(v || null)}
							disabled={!selectedCompanyId || projectsLoading || projectsEmpty}
							aria-label={t('toolbar.ariaSelectProject')}
							options={projectSelectOptions}
							onOpen={onFoundationContextEngage}
						/>
					</fieldset>

					<div
						className="hidden h-7 w-px shrink-0 bg-(--desktop-border-subtle)/70 md:block"
						aria-hidden
					/>

					<fieldset
						aria-label={t('toolbar.documentGroup')}
						className="m-0 flex min-w-0 flex-[1_1_100%] items-center gap-1 border-0 p-0 sm:flex-[1_1_auto] md:max-w-[min(100%,24rem)]"
						title={selectedContentMeta || undefined}
						onMouseEnter={onToolbarContentEngage}
						onFocusCapture={onToolbarContentEngage}
					>
						<span
							className={cn(
								'flex h-8 w-8 shrink-0 items-center justify-center rounded-(--desktop-radius) text-(--desktop-text-dim)',
								toolbarInsetSurface
							)}
						>
							<DocumentDuplicateIcon
								className="h-3.5 w-3.5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						</span>
						<MarketingCabinetSelect
							embeddedInToolbarCluster
							className="min-w-0 flex-1"
							size="compact"
							value={selectedContentId ?? ''}
							onChange={(v) => onContentChange(v || null)}
							disabled={!contentEnabled || contentLoading}
							aria-label={t('toolbar.ariaSelectDocument')}
							options={contentSelectOptions}
							onOpen={onToolbarContentEngage}
						/>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0"
							disabled={!contentEnabled}
							onClick={() => void onRefreshContent()}
							aria-label={t('toolbar.refreshContentAria')}
							title={t('toolbar.refreshContentAria')}
						>
							<ArrowPathIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0"
							disabled={!contentEnabled}
							onClick={onOpenContentManager}
							aria-label={t('toolbar.openContentManagerAria')}
							title={t('toolbar.openContentManagerAria')}
						>
							<ArrowTopRightOnSquareIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					</fieldset>
				</div>

				<div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-1.5">
					<MarketingWebSearchQualitySelect />
					{selectedProjectId && allowMarketingWrite ? (
						<MarketingProjectGenerateAllAiButton
							projectId={selectedProjectId}
							companyId={selectedCompanyId}
							allowMarketingWrite={allowMarketingWrite}
						/>
					) : null}
					<MarketingAiJobCenter
						activeView={activeView}
						selectedProjectId={selectedProjectId}
						selectedCompanyId={selectedCompanyId}
						onNavigate={onJobCenterNavigate}
					/>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={onRefreshCabinet}
						aria-label={t('toolbar.refreshCabinetAria')}
						title={t('toolbar.refreshCabinetAria')}
					>
						<ArrowPathIcon
							className="h-4 w-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={onCopyPageLink}
						aria-label={t('toolbar.copyPageLinkAria')}
						title={t('toolbar.copyPageLinkAria')}
					>
						<LinkIcon className="h-4 w-4" strokeWidth={DESKTOP_LUCIDE.stroke} />
					</DesktopAppButton>
					{canCopyContextId ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={onCopyContextId}
							aria-label={t('toolbar.copyIdAria')}
							title={t('toolbar.copyIdAria')}
						>
							<DocumentDuplicateIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					) : null}
				</div>
			</div>
		</DesktopAppToolbar>
	);
}
