/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Split hero pick lists into Assistants vs IT department sections (shared solo/ensemble chrome).
 *
 * Invariants:
 * - Selection logic stays in the parent; this only renders sectioned buttons.
 *
 * Related:
 * - DesktopAiChatModals.tsx, desktopAiHeroes.ts
 */
import type { TFunction } from 'i18next';
import * as React from 'react';
import {
	type DesktopAiHero,
	type DesktopAiHeroId,
	desktopAiHeroesByCohort,
} from '../desktopAiHeroes';
import { DESKTOP_TYPOGRAPHY } from '../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';

type HeroPickMode = 'solo' | 'ensemble';

type DesktopAiHeroCohortPickListsProps = {
	t: TFunction;
	mode: HeroPickMode;
	selectedSoloId?: DesktopAiHeroId;
	selectedEnsembleIds?: readonly DesktopAiHeroId[];
	onPickSolo?: (id: DesktopAiHeroId) => void;
	onToggleEnsemble?: (id: DesktopAiHeroId) => void;
};

function heroButtonClass(on: boolean, mode: HeroPickMode): string {
	const selectedRing =
		mode === 'ensemble'
			? 'border-[rgb(var(--desktop-accent-rgb)/0.5)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.42)] ring-offset-2 ring-offset-[color-mix(in_srgb,var(--glass-bg-strong)_88%,#0a0520)]'
			: 'border-[rgb(var(--desktop-accent-rgb)/0.5)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.42)] ring-offset-2 ring-offset-[color-mix(in_srgb,var(--glass-bg-strong)_88%,#0a0520)]';
	return [
		'w-full flex items-start gap-3 text-left rounded-xl border px-3 py-3 transition outline-none',
		'focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color-mix(in_srgb,var(--glass-bg-strong)_90%,#0a0520)]',
		on
			? selectedRing
			: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)]',
	].join(' ');
}

function markerClass(on: boolean, mode: HeroPickMode): string {
	if (mode === 'ensemble') {
		return [
			'inline-flex h-3.5 w-3.5 shrink-0 rounded border',
			on
				? 'border-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.9)_100%,white)] bg-[rgb(var(--desktop-accent-rgb))] shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.4)]'
				: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.35)_100%,transparent)] bg-transparent',
		].join(' ');
	}
	return [
		'inline-flex h-3.5 w-3.5 shrink-0 rounded-full border-2',
		on
			? 'border-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.9)_100%,white)] bg-[rgb(var(--desktop-accent-rgb))] shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.4)]'
			: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.35)_100%,transparent)] bg-transparent',
	].join(' ');
}

function HeroSection({
	title,
	heroes,
	mode,
	isOn,
	onPick,
}: {
	title: string;
	heroes: readonly DesktopAiHero[];
	mode: HeroPickMode;
	isOn: (id: DesktopAiHeroId) => boolean;
	onPick: (id: DesktopAiHeroId) => void;
}): React.ReactElement {
	return (
		<div className="space-y-2">
			<p
				className={cn(
					'sticky top-0 z-[1] bg-[color-mix(in_srgb,var(--glass-bg-strong)_92%,transparent)] py-1 font-medium text-(--desktop-text-secondary)',
					DESKTOP_TYPOGRAPHY.caption
				)}
			>
				{title}
			</p>
			{heroes.map((h) => {
				const on = isOn(h.id);
				return (
					<button
						key={h.id}
						type="button"
						onClick={() => onPick(h.id)}
						className={heroButtonClass(on, mode)}
					>
						<img
							src={h.avatarPublicPath}
							alt=""
							className="h-11 w-11 shrink-0 rounded-full object-cover border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.2)_100%,transparent)]"
						/>
						<span className="min-w-0 flex-1">
							<span className="flex items-center gap-2">
								<span className={markerClass(on, mode)} aria-hidden />
								<span className="font-medium text-sm">{h.label}</span>
							</span>
							<span className={cn('mt-1.5 block', DESKTOP_TYPOGRAPHY.meta)}>
								{h.description}
							</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}

export function DesktopAiHeroCohortPickLists({
	t,
	mode,
	selectedSoloId,
	selectedEnsembleIds,
	onPickSolo,
	onToggleEnsemble,
}: DesktopAiHeroCohortPickListsProps): React.ReactElement {
	const assistants = desktopAiHeroesByCohort('assistants');
	const collectiveSouls = desktopAiHeroesByCohort('collective_souls');
	const itDept = desktopAiHeroesByCohort('it_dept');
	const isOn = (id: DesktopAiHeroId): boolean => {
		if (mode === 'ensemble') {
			return Boolean(selectedEnsembleIds?.includes(id));
		}
		return id === selectedSoloId;
	};
	const onPick = (id: DesktopAiHeroId) => {
		if (mode === 'ensemble') {
			onToggleEnsemble?.(id);
			return;
		}
		onPickSolo?.(id);
	};

	return (
		<div className="space-y-4">
			<HeroSection
				title={t('heroPickerCohortAssistants')}
				heroes={assistants}
				mode={mode}
				isOn={isOn}
				onPick={onPick}
			/>
			<HeroSection
				title={t('heroPickerCohortCollectiveSouls')}
				heroes={collectiveSouls}
				mode={mode}
				isOn={isOn}
				onPick={onPick}
			/>
			<HeroSection
				title={t('heroPickerCohortItDept')}
				heroes={itDept}
				mode={mode}
				isOn={isOn}
				onPick={onPick}
			/>
		</div>
	);
}
