import {
	ChevronUpIcon,
	ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { ReactNode, RefObject } from 'react';
import { useLayoutEffect, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { DESKTOP_WINDOW_FRAME_STYLES } from '@/pages/Desktop/utils/desktopVisualSystem';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';

import { MARKETING_CABINET_GUIDE_ROOT_ID } from '../marketingCabinetGuideConstants';
import {
	MarketingCabinetDashboardToolbarPortalProvider,
	useMarketingCabinetDashboardToolbarPortal,
} from './MarketingCabinetDashboardToolbarPortalContext';

const MC_MAIN_COLUMN_SCROLL_STORAGE = 'mc-main-col-scroll:v1:' as const;
const MC_MAIN_COLUMN_SCROLL_DEBOUNCE_MS = 200;

export type MarketingCabinetCompaniesLoadError = {
	message: string;
	onRetry: () => void;
};

export interface MarketingCabinetContentFrameProps {
	contentScrollRef: RefObject<HTMLElement | null>;
	activeModuleTitle: string;
	readOnlyMarketing: boolean;
	focusedEntityId: string | null;
	toolbar: ReactNode;
	showScrollTop: boolean;
	/** Баннер при ошибке загрузки списка компаний (виден во всех разделах). */
	companiesLoadError?: MarketingCabinetCompaniesLoadError | null;
	/** Без левого inset-тени (режим без боковой навигации). */
	omitLeadingInset?: boolean;
	/**
	 * Слот под `createPortal` для панели макета интерактивного дашборда (рядом с основным toolbar в `header`).
	 */
	dashboardToolbarHeaderSlotEnabled?: boolean;
	/**
	 * Ключ sessionStorage для вертикального скролла секции (синхронен с `?mc_*`).
	 * `null` — не писать и не восстанавливать (редкие режимы).
	 */
	mainColumnScrollStorageKey?: string | null;
	/**
	 * Увеличивается при `popstate` в хуке навигации — восстановить скролл из sessionStorage.
	 */
	mainColumnScrollPopStateGeneration?: number;
	children: ReactNode;
}

export function MarketingCabinetContentFrame(
	props: MarketingCabinetContentFrameProps
) {
	return (
		<MarketingCabinetDashboardToolbarPortalProvider>
			<MarketingCabinetContentFrameInner {...props} />
		</MarketingCabinetDashboardToolbarPortalProvider>
	);
}

function MarketingCabinetContentFrameInner({
	contentScrollRef,
	activeModuleTitle,
	readOnlyMarketing,
	focusedEntityId,
	toolbar,
	showScrollTop,
	companiesLoadError,
	omitLeadingInset = false,
	dashboardToolbarHeaderSlotEnabled = false,
	mainColumnScrollStorageKey = null,
	mainColumnScrollPopStateGeneration = 0,
	children,
}: MarketingCabinetContentFrameProps) {
	const { t } = useTranslation('marketing');
	const shellFrame = useDesktopShellFrame();
	const shellContentTint =
		DESKTOP_WINDOW_FRAME_STYLES[shellFrame]?.content ??
		DESKTOP_WINDOW_FRAME_STYLES.glass.content;
	const dashboardToolbarPortal = useMarketingCabinetDashboardToolbarPortal();
	if (!dashboardToolbarPortal) {
		throw new Error(
			'MarketingCabinetDashboardToolbarPortalProvider is required (wrap MarketingCabinetContentFrame with the provider)'
		);
	}
	const { setMountNode } = dashboardToolbarPortal;
	const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastRestoredGenRef = useRef<number>(0);

	useLayoutEffect(() => {
		if (!mainColumnScrollStorageKey) return;
		if (mainColumnScrollPopStateGeneration === 0) return;
		if (lastRestoredGenRef.current === mainColumnScrollPopStateGeneration) {
			return;
		}
		lastRestoredGenRef.current = mainColumnScrollPopStateGeneration;
		const el = contentScrollRef.current;
		if (!el) return;
		const raw = sessionStorage.getItem(
			`${MC_MAIN_COLUMN_SCROLL_STORAGE}${mainColumnScrollStorageKey}`
		);
		if (raw == null) return;
		const top = Number.parseInt(raw, 10);
		if (!Number.isFinite(top) || top < 0) return;
		requestAnimationFrame(() => {
			el.scrollTo({ top, behavior: 'auto' });
		});
	}, [
		mainColumnScrollStorageKey,
		mainColumnScrollPopStateGeneration,
		contentScrollRef,
	]);

	useEffect(() => {
		if (!mainColumnScrollStorageKey) return;
		const el = contentScrollRef.current;
		if (!el) return;
		const onScroll = () => {
			if (scrollSaveTimerRef.current) {
				clearTimeout(scrollSaveTimerRef.current);
			}
			scrollSaveTimerRef.current = setTimeout(() => {
				scrollSaveTimerRef.current = null;
				sessionStorage.setItem(
					`${MC_MAIN_COLUMN_SCROLL_STORAGE}${mainColumnScrollStorageKey}`,
					String(Math.round(el.scrollTop))
				);
			}, MC_MAIN_COLUMN_SCROLL_DEBOUNCE_MS);
		};
		el.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			el.removeEventListener('scroll', onScroll);
			if (scrollSaveTimerRef.current) {
				clearTimeout(scrollSaveTimerRef.current);
			}
		};
	}, [mainColumnScrollStorageKey, contentScrollRef]);

	return (
		<main
			id="marketing-cabinet-main"
			className={cn(
				'flex min-w-0 flex-1 flex-col overflow-hidden bg-(--mc-main-bg-gradient)',
				!omitLeadingInset &&
					'shadow-[inset_1px_0_0_0_var(--desktop-border-subtle)]'
			)}
			tabIndex={-1}
			aria-label={activeModuleTitle}
		>
			<div
				id={MARKETING_CABINET_GUIDE_ROOT_ID}
				className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
			>
				<header
					className={cn(
						'relative z-20 shrink-0 border-b border-(--desktop-border-subtle)/55',
						shellContentTint
					)}
				>
					{toolbar}
					{dashboardToolbarHeaderSlotEnabled ? (
						<div
							ref={(el) => {
								setMountNode(el);
							}}
							className={cn(
								'min-h-0 min-w-0 shrink-0 border-t border-(--desktop-border-subtle)/55',
								shellContentTint
							)}
						/>
					) : null}
				</header>
				{readOnlyMarketing ? (
					<div className="shrink-0 border-b border-(--mc-border-accent-soft) bg-(--mc-readonly-banner-bg) px-4 py-2.5 text-xs leading-snug text-(--desktop-text-secondary) sm:px-7">
						{t('cabinetPage.readOnlyMarketing.banner', {
							defaultValue:
								'Просмотр от имени заказчика: редактирование данных и ИИ-инструменты отключены.',
						})}
					</div>
				) : null}
				{companiesLoadError ? (
					<div
						className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[color-mix(in_srgb,rgb(239_68_68)_35%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,rgb(239_68_68)_10%,var(--desktop-surface-soft))] px-4 py-2.5 sm:px-7"
						role="status"
						aria-live="polite"
					>
						<ExclamationTriangleIcon
							className="h-4 w-4 shrink-0 text-[color-mix(in_srgb,rgb(248_113_113)_75%,var(--desktop-text-muted))]"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						<p className="min-w-0 flex-1 text-xs leading-snug text-(--desktop-text-secondary)">
							{companiesLoadError.message}
						</p>
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							onClick={companiesLoadError.onRetry}
						>
							{t('cabinetPage.retryCompaniesLoad')}
						</DesktopAppButton>
					</div>
				) : null}

				<section
					ref={contentScrollRef}
					className="relative z-0 min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-6 sm:px-7 sm:py-8"
					aria-label={t('contentRegionAria')}
					data-focused-entity={focusedEntityId ?? undefined}
				>
					{children}
					{showScrollTop ? (
						<DesktopAppButton
							type="button"
							variant="accent"
							size="icon"
							className="fixed bottom-5 right-5 z-40 shadow-lg sm:bottom-8 sm:right-8"
							onClick={() => {
								const el = contentScrollRef.current;
								if (!el) return;
								const reduce =
									typeof window !== 'undefined' &&
									window.matchMedia('(prefers-reduced-motion: reduce)').matches;
								el.scrollTo({
									top: 0,
									behavior: reduce ? 'auto' : 'smooth',
								});
							}}
							aria-label={t('cabinetPage.scrollTopAria')}
						>
							<ChevronUpIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						</DesktopAppButton>
					) : null}
				</section>
			</div>
		</main>
	);
}
