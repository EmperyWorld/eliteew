/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ensemble routing mode dropdown for Desktop AI Chat settings rail.
 *
 * Invariants:
 * - Parent closes project menu before opening routing menu via onToggle.
 *
 * Related:
 * - components/DesktopAiChatSettingsRail.tsx, hooks/useDesktopAiChatEnsemble.ts
 */
import type { TFunction } from 'i18next';
import * as React from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import {
	DESKTOP_ENSEMBLE_ROUTING_MODE_ORDER,
	type DesktopEnsembleRoutingMode,
} from '../desktopAiHeroes';

export type DesktopAiChatEnsembleControlsProps = {
	routingMenuRef: React.RefObject<HTMLDivElement | null>;
	menuOpen: boolean;
	routingMode: DesktopEnsembleRoutingMode;
	routingModeLabel: string;
	routingBusy: boolean;
	onToggle: () => void;
	onSelectMode: (mode: DesktopEnsembleRoutingMode) => void;
	t: TFunction<'desktopAiChat'>;
	lucideStroke: number;
};

export function DesktopAiChatEnsembleControls({
	routingMenuRef,
	menuOpen,
	routingMode,
	routingModeLabel,
	routingBusy,
	onToggle,
	onSelectMode,
	t,
	lucideStroke,
}: DesktopAiChatEnsembleControlsProps) {
	return (
		<div
			ref={routingMenuRef}
			className="relative flex-1 min-w-[140px] max-w-xs"
		>
			<button
				type="button"
				id="desktop-ai-chat-ensemble-routing-trigger"
				disabled={routingBusy}
				aria-expanded={menuOpen}
				aria-haspopup="listbox"
				aria-controls="desktop-ai-chat-ensemble-routing-list"
				onClick={onToggle}
				className={`w-full min-w-0 text-left rounded-lg border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.28)_100%,transparent)] px-2 py-1 text-xs text-(--desktop-text-secondary) antialiased disabled:opacity-45 flex items-center justify-between gap-1`}
			>
				<span className="truncate">{routingModeLabel}</span>
				<ChevronDownIcon
					className="h-3.5 w-3.5 shrink-0 opacity-70"
					strokeWidth={lucideStroke}
				/>
			</button>
			{menuOpen ? (
				<div
					id="desktop-ai-chat-ensemble-routing-list"
					className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)] bg-[color-mix(in_srgb,var(--glass-bg-strong)_95%,#0a0520)] shadow-lg max-h-60 overflow-y-auto py-0.5"
					role="listbox"
					aria-labelledby="desktop-ai-chat-ensemble-routing-trigger"
				>
					{DESKTOP_ENSEMBLE_ROUTING_MODE_ORDER.map((m) => {
						const optLabel =
							m === 'auto'
								? t('ensembleRoutingAuto')
								: m === 'semi'
									? t('ensembleRoutingSemi')
									: m === 'chat_only'
										? t('ensembleRoutingChatOnly')
										: t('ensembleRoutingBlueprintOnly');
						const selected = m === routingMode;
						const optCls = [
							'w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)]',
							selected
								? 'bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] text-(--desktop-text-primary)'
								: 'text-(--desktop-text-secondary)',
						].join(' ');
						return (
							<button
								key={m}
								type="button"
								role="option"
								aria-selected={selected}
								className={optCls}
								onClick={() => onSelectMode(m)}
							>
								<span className="block font-medium leading-snug">
									{optLabel}
								</span>
							</button>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
