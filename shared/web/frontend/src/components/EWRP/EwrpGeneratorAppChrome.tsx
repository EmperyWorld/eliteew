/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP desktop window chrome: product header and Generate / Presentations tablist.
 * Props-driven — Main owns tab state and status indicator inputs.
 *
 * Invariants:
 * - Stable tab ids: `ewrp-tab-generate` / `ewrp-tab-presentations` (panel aria wiring).
 * - No orchestration SoT — only presentational chrome.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `EwrpGenerateTabPanel.tsx`, `EwrpPresentationsTabPanel.tsx`
 * - `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { EwrpStatusResponse } from '../../services/ewrpApi';
import { sw } from './EwrpGeneratorChunks';
import { EwrpStatusPhaseChip } from './EwrpStatusPhaseChip';
import { PresentationChartBarIcon } from '@heroicons/react/24/outline';

export type EwrpGeneratorAppChromeProps = {
	shellHeader: string;
	mainTab: 'generate' | 'presentations';
	onMainTabChange: (tab: 'generate' | 'presentations') => void;
	jobId: string | null;
	status: EwrpStatusResponse | null;
	statusIndicator: { label: string } | null;
};

export function EwrpGeneratorAppChrome({
	shellHeader,
	mainTab,
	onMainTabChange,
	jobId,
	status,
	statusIndicator,
}: EwrpGeneratorAppChromeProps) {
	const { t } = useTranslation('ewrp');
	return (
		<>
			<header
				className={cn(
					shellHeader,
					'shrink-0 border-b border-(--desktop-border-subtle)/60 px-3 py-2 sm:px-5 sm:py-2.5'
				)}
			>
				<div className="flex w-full items-center gap-2.5 sm:gap-3">
					<div
						className={cn(
							'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-(--desktop-border-subtle)',
							'bg-[linear-gradient(152deg,rgba(63,63,70,0.22)_0%,rgba(24,24,27,0.88)_100%)] shadow-[0_8px_20px_rgba(0,0,0,0.28)]',
							'ring-1 ring-inset ring-white/8'
						)}
					>
						<PresentationChartBarIcon
							className="h-4 w-4 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
							strokeWidth={sw}
						/>
					</div>
					<div className="min-w-0 flex-1">
						<h1 className="truncate text-sm font-semibold tracking-tight text-(--desktop-text-primary) sm:text-[15px]">
							EWRP — Revolutionary Presentations
						</h1>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.small,
								'hidden truncate text-(--desktop-text-dim) sm:block'
							)}
						>
							{t('header.subtitle')}
						</p>
					</div>
				</div>
			</header>
			<nav
				className="shrink-0 border-b border-(--desktop-border-subtle)/50 bg-(--desktop-surface-app) px-4 sm:px-6 lg:px-8"
				aria-label={t('tabs.navAria')}
				data-ewrp-guide="tabs"
			>
				<div className="flex max-w-5xl gap-0.5" role="tablist">
					<button
						type="button"
						role="tab"
						id="ewrp-tab-generate"
						aria-selected={mainTab === 'generate'}
						aria-controls="ewrp-panel-generate"
						onClick={() => onMainTabChange('generate')}
						className={cn(
							'relative px-3 py-2.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm',
							DESKTOP_CHROME_FOCUS_VISIBLE,
							mainTab === 'generate'
								? 'text-(--desktop-text-primary)'
								: 'text-(--desktop-text-muted) hover:text-(--desktop-text-secondary)'
						)}
					>
						{mainTab === 'generate' ? (
							<span
								className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.95)]"
								aria-hidden
							/>
						) : null}
						<span className="relative">{t('tabs.generate')}</span>
					</button>
					<button
						type="button"
						role="tab"
						id="ewrp-tab-presentations"
						aria-selected={mainTab === 'presentations'}
						aria-controls="ewrp-panel-presentations"
						onClick={() => onMainTabChange('presentations')}
						className={cn(
							'relative px-3 py-2.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm',
							DESKTOP_CHROME_FOCUS_VISIBLE,
							mainTab === 'presentations'
								? 'text-(--desktop-text-primary)'
								: 'text-(--desktop-text-muted) hover:text-(--desktop-text-secondary)'
						)}
					>
						{mainTab === 'presentations' ? (
							<span
								className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.95)]"
								aria-hidden
							/>
						) : null}
						<span className="relative inline-flex items-center gap-1.5">
							{t('tabs.presentations')}
							{jobId && status && mainTab === 'generate' && statusIndicator ? (
								<>
									<EwrpStatusPhaseChip
										status={status.status}
										updatedAt={status.updated_at}
										size="tab"
										iconOnly
										title={statusIndicator.label}
									/>
									<span className="sr-only">
										{t('tabs.presentationsStatus', {
											status: statusIndicator.label,
										})}
									</span>
								</>
							) : null}
						</span>
					</button>
				</div>
			</nav>
		</>
	);
}
