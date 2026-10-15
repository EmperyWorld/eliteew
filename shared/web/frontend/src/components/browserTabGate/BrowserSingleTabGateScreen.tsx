/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single-tab / follower gate screen — desktop-token surface, i18n via `commonUi.singleTab`,
 * shared by leader-tab gate and minimal follower SPA entry.
 *
 * Invariants:
 * - No acid/lime EliteTechnicalState dialect; uses `--desktop-*` tokens.
 * - Copy only from `commonUi` (follower-safe namespace).
 *
 * Related:
 * - `PassiveFollowerTabScreen.tsx`, `SingleTabElectionGate.tsx`, `followerMain.tsx`
 * - `documentation/product/desktop/DESKTOP_DESIGN_SYSTEM.md`
 */

import type { CSSProperties, FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_UI_NS } from '@/i18n/namespaces';
import { cn } from '@/utils/cn';
import {
	DESKTOP_DEFAULT_ACCENT_RGB,
	DESKTOP_DESIGN_TOKENS,
} from '@/pages/Desktop/constants/desktopDesignTokens';

export type BrowserSingleTabGateMode = 'follower' | 'handoffWaiting';

export type BrowserSingleTabGateScreenProps = {
	mode: BrowserSingleTabGateMode;
	/** Product name interpolated into follower title (default EliteEW). */
	contextLabel?: string;
	onTakeLeadership?: () => void;
	onCloseTab?: () => void;
	footnote?: ReactNode;
	className?: string;
};

const GATE_ROOT_STYLE = {
	...DESKTOP_DESIGN_TOKENS,
	'--desktop-accent-rgb': DESKTOP_DEFAULT_ACCENT_RGB,
	background: 'rgb(var(--desktop-bg-primary-rgb))',
} as CSSProperties;

const focusRing =
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]';

export const BrowserSingleTabGateScreen: FC<
	BrowserSingleTabGateScreenProps
> = ({
	mode,
	contextLabel = 'EliteEW',
	onTakeLeadership,
	onCloseTab,
	footnote,
	className,
}) => {
	const { t } = useTranslation(COMMON_UI_NS);
	const isHandoff = mode === 'handoffWaiting';

	const title = isHandoff
		? t('singleTab.handoffTitle')
		: t('singleTab.followerTitle', { context: contextLabel });
	const description = isHandoff
		? t('singleTab.handoffDescription')
		: t('singleTab.followerDescription');
	const statusLabel = isHandoff
		? t('singleTab.handoffStatus')
		: t('singleTab.followerStatus');
	const defaultFootnote = isHandoff
		? t('singleTab.handoffFootnote')
		: t('singleTab.followerFootnote');

	return (
		<section
			className={cn(
				'relative isolate flex min-h-screen items-center justify-center overflow-hidden p-5',
				className
			)}
			style={GATE_ROOT_STYLE}
			role={isHandoff ? 'status' : 'dialog'}
			aria-live="polite"
			aria-labelledby="browser-single-tab-gate-title"
			aria-describedby="browser-single-tab-gate-desc"
			data-testid={
				isHandoff ? 'browser-single-tab-handoff' : 'browser-single-tab-follower'
			}
		>
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						'radial-gradient(circle at 20% 0%, rgb(var(--desktop-accent-rgb) / 0.16), transparent 42%), radial-gradient(circle at 80% 100%, rgb(var(--desktop-accent-rgb) / 0.08), transparent 36%)',
				}}
				aria-hidden
			/>
			<div
				className={cn(
					'relative z-10 w-full max-w-md rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle)',
					'bg-(--desktop-surface-panel-strong) p-6 shadow-(--desktop-shadow-panel) backdrop-blur-xl'
				)}
			>
				<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-(--desktop-text-muted)">
					{t('singleTab.eyebrow')}
				</p>
				<p
					className="mt-3 inline-flex rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-1 text-xs text-(--desktop-text-secondary)"
					data-testid="browser-single-tab-status"
				>
					{statusLabel}
				</p>
				<h1
					id="browser-single-tab-gate-title"
					className="mt-4 text-lg font-semibold tracking-tight text-(--desktop-text-primary)"
				>
					{title}
				</h1>
				<p
					id="browser-single-tab-gate-desc"
					className="mt-2 text-sm leading-6 text-(--desktop-text-secondary)"
				>
					{description}
				</p>
				{!isHandoff && onTakeLeadership ? (
					<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-stretch">
						<button
							type="button"
							onClick={onTakeLeadership}
							className={cn(
								'min-h-11 flex-1 rounded-(--desktop-radius) border border-[rgb(var(--desktop-accent-rgb)/0.35)]',
								'bg-(--desktop-surface-accent) px-4 py-2.5 text-sm font-medium text-(--desktop-text-primary)',
								'hover:bg-(--desktop-surface-accent-strong)',
								focusRing
							)}
							data-testid="browser-single-tab-take-leadership"
						>
							{t('singleTab.useThisTab')}
						</button>
						<button
							type="button"
							onClick={
								onCloseTab ??
								(() => {
									window.close();
								})
							}
							className={cn(
								'min-h-11 flex-1 rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
								'bg-(--desktop-surface-soft) px-4 py-2.5 text-sm font-medium text-(--desktop-text-secondary)',
								'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
								focusRing
							)}
							data-testid="browser-single-tab-close"
						>
							{t('singleTab.closeTab')}
						</button>
					</div>
				) : null}
				<div className="mt-5 text-xs leading-5 text-(--desktop-text-muted)">
					{footnote ?? defaultFootnote}
				</div>
			</div>
		</section>
	);
};
