/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Generic desktop shell for Professional Worlds runtime experiences.
 *
 * Invariants:
 * - Owns chrome, navigation, loading and retry states, but not vertical-specific panels.
 * - Receives translated labels from the caller so vertical modules can evolve independently.
 * - Profession vertical picker lives in the toolbar beside Refresh whenever the catalog exposes at least one vertical; optional optgroups separate already-open professions from ones still awaiting activation.
 * - Main content uses generous bottom padding so long pages scroll past the framed panel clip.
 * - Optional `guideRootId` / `guideLaunchButton` wire GT-9a spotlight tour without coupling shell to tour modal.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - runtimeModuleRegistry.tsx
 */

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopAppContentWrapper,
	DesktopAppPanel,
	DesktopAppSkeleton,
	DesktopAppToolbar,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import { MOBILE_EMBEDDED_APP_ROOT_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { useProfessionalWorldsSurfaceLayout } from './hooks/useProfessionalWorldsSurfaceLayout';
import { ProfessionalWorldsSidebarNav } from './layout/ProfessionalWorldsSidebarNav';
import {
	ProfessionalWorldsStatePanel,
	ProfessionalWorldsStatusBanner,
} from './layout';
import { VerticalSwitcherPopover } from './components/VerticalSwitcherPopover';
import {
	PW_WORKSPACE_MAIN_CLASS,
	pwShellBodyClass,
	pwSidebarPanelShellClass,
} from './layout/professionalWorldsLayoutTokens';

export type ProfessionalWorldsRuntimeNavItem<TView extends string> = {
	id: TView;
	label: string;
	disabled?: boolean;
	/** Visual lock badge in sidebar; label stays without suffix. */
	locked?: boolean;
	/** Visible explanation for locked/unavailable sections; never rely on `title` only. */
	lockReason?: string;
	title?: string;
};

/** Toolbar `<select>` row: `needsActivation` drives optgroup layout when labels are provided. */
export type ProfessionalWorldsVerticalToolbarOption = {
	slug: string;
	label: string;
	needsActivation?: boolean;
};

export function ProfessionalWorldsRuntimeShell<TView extends string>({
	activeView,
	children,
	error,
	errorTitle,
	loading,
	navItems,
	navLabel,
	onRefresh,
	onRetry,
	onSelectView,
	onToggleNavMode,
	navMode,
	navModeToggleLabel,
	refreshLabel,
	retryLabel,
	runtimeNotice,
	safetyBody,
	safetyTitle,
	subtitle,
	title,
	verticalOptions,
	activeVerticalSlug,
	onSelectVertical,
	verticalSelectAriaLabel,
	verticalToolbarDisabled,
	verticalToolbarAlert,
	verticalOptgroupLabels,
	guideRootId,
	guideLaunchButton,
	embeddedMobile = false,
}: {
	activeView: TView;
	activeVerticalSlug?: string;
	children: ReactNode;
	embeddedMobile?: boolean;
	error: string | null;
	errorTitle: string;
	loading: boolean;
	navItems: ProfessionalWorldsRuntimeNavItem<TView>[];
	navLabel: string;
	onRefresh: () => void;
	onRetry: () => void;
	onSelectView: (view: TView) => void;
	onToggleNavMode?: () => void;
	navMode?: 'compact' | 'full';
	navModeToggleLabel?: string;
	refreshLabel: string;
	retryLabel: string;
	runtimeNotice?: string | null;
	safetyBody: string;
	safetyTitle: string;
	subtitle: string;
	title: string;
	verticalOptions?: ProfessionalWorldsVerticalToolbarOption[];
	onSelectVertical?: (verticalSlug: string) => void;
	verticalSelectAriaLabel?: string;
	verticalToolbarDisabled?: boolean;
	verticalToolbarAlert?: string | null;
	verticalOptgroupLabels?: { active: string; connect: string };
	guideRootId?: string;
	guideLaunchButton?: ReactNode;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { surfaceRef, isCompact: layoutIsCompact } =
		useProfessionalWorldsSurfaceLayout();
	const isCompact = embeddedMobile || layoutIsCompact;

	const verticalSelectValue = useMemo(() => {
		if (!verticalOptions?.length) return activeVerticalSlug ?? '';
		const match = verticalOptions.some(
			(opt) => opt.slug === activeVerticalSlug
		);
		if (match) return activeVerticalSlug ?? '';
		return verticalOptions[0]?.slug ?? '';
	}, [activeVerticalSlug, verticalOptions]);

	return (
		<DesktopAppContentWrapper
			appComponent="ProfessionalWorlds"
			mode="framed"
			className={cn(
				'flex h-full min-h-0 flex-col',
				embeddedMobile && MOBILE_EMBEDDED_APP_ROOT_CLASS
			)}
		>
			<div
				ref={surfaceRef}
				id={guideRootId}
				data-professional-worlds-root={embeddedMobile ? '1' : undefined}
				data-embedded-mobile={embeddedMobile ? '1' : undefined}
				className="relative flex min-h-0 flex-1 flex-col"
			>
				{embeddedMobile ? <h1 className="sr-only">{title}</h1> : null}
				<DesktopAppToolbar
					data-pw-guide="header"
					className="relative items-start justify-between gap-3 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)"
				>
					{guideLaunchButton}
					{!embeddedMobile ? (
						<div className="grid min-w-0 flex-1 gap-1.5">
							<div className="flex flex-wrap items-center gap-2">
								<span className="rounded-full border border-[rgb(var(--desktop-accent-rgb))]/25 bg-(--desktop-surface-accent) px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--desktop-text-secondary)">
									{t('shell.workspaceBadge')}
								</span>
								{navMode ? (
									<span className="rounded-full bg-(--desktop-surface-soft) px-2 py-0.5 text-[10px] text-(--desktop-text-muted)">
										{navMode === 'compact'
											? t('shell.focusedStart')
											: t('shell.fullMenu')}
									</span>
								) : null}
							</div>
							<div className="grid gap-1">
								<h2 className="truncate text-lg font-semibold leading-tight text-(--desktop-text-primary)">
									{title}
								</h2>
								<p className="max-w-3xl truncate text-xs text-(--desktop-text-secondary)">
									{subtitle}
								</p>
							</div>
						</div>
					) : (
						<div className="min-w-0 flex-1" aria-hidden />
					)}
					<div className="flex shrink-0 flex-col items-end gap-1.5">
						<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
							{verticalOptions && verticalOptions.length > 0 ? (
								<VerticalSwitcherPopover
									options={verticalOptions}
									value={verticalSelectValue}
									disabled={verticalToolbarDisabled === true}
									ariaLabel={
										verticalSelectAriaLabel ?? 'Active professional vertical'
									}
									optgroupLabels={verticalOptgroupLabels}
									onChange={(slug) => onSelectVertical?.(slug)}
									className="w-full min-w-36 max-w-[min(20rem,calc(100vw-10rem))]"
								/>
							) : null}
							{onToggleNavMode && navModeToggleLabel ? (
								<DesktopAppButton
									size="sm"
									variant="ghost"
									onClick={onToggleNavMode}
									aria-pressed={navMode === 'full'}
								>
									{navModeToggleLabel}
								</DesktopAppButton>
							) : null}
							<DesktopAppButton size="sm" onClick={onRefresh}>
								{refreshLabel}
							</DesktopAppButton>
						</div>
						{verticalToolbarAlert ? (
							<ProfessionalWorldsStatusBanner
								kind="error"
								role="alert"
								className="max-w-[min(28rem,100%)] text-right"
							>
								{verticalToolbarAlert}
							</ProfessionalWorldsStatusBanner>
						) : null}
					</div>
				</DesktopAppToolbar>

				<div className={pwShellBodyClass(embeddedMobile)}>
					<DesktopAppPanel
						data-pw-guide="sidebar"
						className={pwSidebarPanelShellClass(embeddedMobile, isCompact)}
					>
						<ProfessionalWorldsSidebarNav
							activeView={activeView}
							collapsedSafety={isCompact}
							layoutMode={embeddedMobile ? 'horizontal' : 'vertical'}
							navItems={navItems}
							navLabel={navLabel}
							safetyBody={safetyBody}
							safetyTitle={safetyTitle}
							onSelectView={onSelectView}
						/>
					</DesktopAppPanel>

					<main className={PW_WORKSPACE_MAIN_CLASS} data-pw-guide="workspace">
						{loading ? (
							<DesktopAppSkeleton className="h-80" />
						) : error ? (
							<ProfessionalWorldsStatePanel
								state="error"
								title={errorTitle}
								description={error}
								onRetry={onRetry}
								retryLabel={retryLabel}
							/>
						) : (
							<div className="grid gap-3">
								{runtimeNotice ? (
									<div className="rounded-(--desktop-radius) border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) px-3 py-2 text-xs text-(--desktop-text-primary)">
										{runtimeNotice}
									</div>
								) : null}
								{children}
							</div>
						)}
					</main>
				</div>
			</div>
		</DesktopAppContentWrapper>
	);
}
