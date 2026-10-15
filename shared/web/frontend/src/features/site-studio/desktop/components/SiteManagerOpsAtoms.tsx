/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared low-level presentation atoms and confirmation controls for the Site Manager operator panel.
 * Keeps repeated card, section, metric and confirm-action chrome out of orchestration logic.
 *
 * Invariants:
 * - These atoms do not call Site Manager APIs directly.
 * - Visual tone is passed by callers; atoms do not infer domain state.
 *
 * Related:
 * - ./SiteManagerOpsPanel.tsx
 * - ./SiteManagerSiteCards.tsx
 */
import * as React from 'react';
import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
	ShieldCheckIcon,
} from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';

export const MetricCard: React.FC<{
	label: string;
	value: React.ReactNode;
	tone?: 'ok' | 'warn';
}> = ({ label, value, tone }) => (
	<DesktopAppSurface variant="soft" padding="sm">
		<div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
			{tone === 'ok' ? (
				<CheckCircleIcon className="size-4 text-emerald-200" />
			) : null}
			{tone === 'warn' ? (
				<ExclamationTriangleIcon className="size-4 text-amber-200" />
			) : null}
			{label}
		</div>
		<div className="mt-2 text-xl font-semibold text-(--desktop-text-primary)">
			{value}
		</div>
	</DesktopAppSurface>
);

export const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
	<div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
		<ShieldCheckIcon className="size-4" aria-hidden />
		{title}
	</div>
);

export const RowCard: React.FC<React.PropsWithChildren> = ({ children }) => (
	<div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-(--desktop-border) bg-(--desktop-surface) p-3">
		{children}
	</div>
);

export const EmptyLine: React.FC<{ text: string }> = ({ text }) => (
	<div className="rounded-md border border-(--desktop-border) bg-(--desktop-surface) p-3 text-sm text-(--desktop-text-muted)">
		{text}
	</div>
);

export type SiteManagerViewMode = 'attention' | 'domains' | 'advanced';

export const ViewModeTabs: React.FC<{
	activeMode: SiteManagerViewMode;
	onChange: (mode: SiteManagerViewMode) => void;
	labels: Record<SiteManagerViewMode, string>;
	ariaLabel: string;
}> = ({ activeMode, onChange, labels, ariaLabel }) => (
	<div
		role="tablist"
		aria-label={ariaLabel}
		className="flex flex-wrap gap-1 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-1"
		data-testid="site-manager-view-mode-tabs"
	>
		{(['attention', 'domains', 'advanced'] as const).map((mode) => (
			<DesktopAppButton
				key={mode}
				type="button"
				size="sm"
				role="tab"
				aria-selected={activeMode === mode}
				variant={activeMode === mode ? 'accent' : 'ghost'}
				data-testid={`site-manager-view-${mode}`}
				onClick={() => onChange(mode)}
			>
				{labels[mode]}
			</DesktopAppButton>
		))}
	</div>
);

export const ConfirmableActionButton: React.FC<{
	actionId: string;
	busy: string | null;
	confirmAction: string | null;
	label: string;
	confirmLabel: string;
	cancelLabel: string;
	onConfirmAction: (action: string | null) => void;
	onRun: () => void;
}> = ({
	actionId,
	busy,
	confirmAction,
	label,
	confirmLabel,
	cancelLabel,
	onConfirmAction,
	onRun,
}) => {
	const isConfirming = confirmAction === actionId;
	return (
		<div className="flex flex-wrap gap-1">
			<DesktopAppButton
				type="button"
				size="sm"
				variant={isConfirming ? 'danger' : 'ghost'}
				disabled={busy === actionId}
				data-testid={`site-manager-confirm-action-${actionId}`}
				onClick={() => {
					if (isConfirming) {
						onRun();
						return;
					}
					onConfirmAction(actionId);
				}}
			>
				{isConfirming ? confirmLabel : label}
			</DesktopAppButton>
			{isConfirming ? (
				<DesktopAppButton
					type="button"
					size="sm"
					variant="ghost"
					onClick={() => onConfirmAction(null)}
				>
					{cancelLabel}
				</DesktopAppButton>
			) : null}
		</div>
	);
};
