/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EBrowser tab strip with close-others context action.
 */

import { cn } from '@/utils/cn';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ReactElement } from 'react';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { EBrowserTabView } from '@/features/ebrowser/ebrowserNative';

function tabChromeLabel(tab: EBrowserTabView, activeTitle: string): string {
	if (tab.active && activeTitle.trim()) {
		return activeTitle.trim().slice(0, 36);
	}
	const href = (tab.href || '').trim();
	if (!href || href === 'about:blank') return '—';
	try {
		const host = new URL(href).hostname;
		return host || href.slice(0, 28);
	} catch {
		return href.replace(/^https?:\/\//i, '').slice(0, 28);
	}
}

export function EBrowserTabStrip(props: {
	tabs: EBrowserTabView[];
	pageTitle: string;
	maxTabs: number;
	busy: boolean;
	labels: {
		tabs: string;
		newTab: string;
		closeTab: (id: number) => string;
		closeOthers: string;
		blankTab: string;
	};
	onSwitch: (id: number) => void;
	onClose: (id: number) => void;
	onNew: () => void;
	onCloseOthers: (keepId: number) => void;
}): ReactElement | null {
	const { tabs, labels } = props;
	if (tabs.length === 0) return null;
	return (
		<div
			className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-(--desktop-border-subtle) bg-(--desktop-surface-app) px-2 py-1.5"
			role="tablist"
			aria-label={labels.tabs}
		>
			{tabs.map((tab) => (
				<div key={tab.id} className="flex max-w-[12rem] shrink-0 items-center">
					<button
						type="button"
						role="tab"
						aria-selected={tab.active}
						onClick={() => props.onSwitch(tab.id)}
						onContextMenu={(e) => {
							e.preventDefault();
							if (tabs.length > 1) props.onCloseOthers(tab.id);
						}}
						title={
							tabs.length > 1
								? `${tab.href || labels.blankTab} · ${labels.closeOthers}`
								: tab.href || labels.blankTab
						}
						className={cn(
							'min-w-0 flex-1 truncate rounded-lg border px-2.5 py-1.5 text-left transition-colors',
							DESKTOP_TYPOGRAPHY.captionInherit,
							tab.active
								? 'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-(--desktop-surface-accent) text-(--desktop-text-primary)'
								: 'border-transparent bg-transparent text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft)'
						)}
					>
						{tabChromeLabel(tab, props.pageTitle) === '—'
							? labels.blankTab
							: tabChromeLabel(tab, props.pageTitle)}
					</button>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						aria-label={labels.closeTab(tab.id)}
						onClick={() => props.onClose(tab.id)}
						className="h-7 w-7 min-h-7 min-w-7"
					>
						<XMarkIcon className="h-3.5 w-3.5" aria-hidden />
					</DesktopAppButton>
				</div>
			))}
			<DesktopChromeTooltip content={labels.newTab} placement="bottom">
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="icon"
					disabled={props.busy || tabs.length >= props.maxTabs}
					onClick={() => props.onNew()}
					aria-label={labels.newTab}
					className="h-8 w-8 min-h-8 min-w-8 shrink-0"
				>
					<PlusIcon className="h-4 w-4" aria-hidden />
				</DesktopAppButton>
			</DesktopChromeTooltip>
		</div>
	);
}
