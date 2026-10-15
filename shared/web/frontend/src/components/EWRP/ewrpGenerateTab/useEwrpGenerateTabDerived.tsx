/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derived labels, mismatch flags, shell class names, and energy detail for the
 * Generate-tab presentational panel (props-only; no local store).
 *
 * Invariants:
 * - Pure derivation from props + i18n — no side effects beyond memoization.
 *
 * Related:
 * - `EwrpGenerateTabPanel.tsx`, `ewrpStickyContextMismatch.ts`, `ewrpGenerateWorkspaceLabel.ts`
 */

import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { getDesktopShellContentPanelClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import type { DesktopWindowStyle } from '@/types/profile';
import {
	EWRP_PRESENTATION_THEME_IDS,
	EWRP_LEGACY_CREDITS_PER_SLIDE,
	type EwrpPresentationThemeId,
} from '../EwrpGeneratorChunks';
import {
	ewrpStickySlidesMismatch,
	ewrpStickyThemeMismatch,
	resolveEwrpStatusSlideCount,
} from '../ewrpStickyContextMismatch';
import { resolveEwrpGenerateWorkspaceLabel } from '../ewrpGenerateWorkspaceLabel';
import type { EwrpStatusResponse } from '@/services/ewrpApi';

export type EwrpGenerateTabDerivedInput = {
	topic: string;
	title: string;
	jobId: string | null;
	status: EwrpStatusResponse | null;
	numSlides: number;
	presentationTheme: string;
	sourceDocumentLoading: boolean;
	shellPanel: string;
	shellFrame: DesktopWindowStyle;
	perSlideCredits: number;
};

export type EwrpGenerateTabDerived = {
	stickyHeadline: string;
	statusMetaSlideCount: number | null;
	stickySlidesMismatch: boolean;
	stickyFormThemeLabel: string | null;
	stickyFormThemeDisplayLabel: string;
	stickyJobThemeLabel: string | null;
	stickyThemeMismatch: boolean;
	stickyFormSourcePending: boolean;
	presentationEnergyDetail: ReactNode;
	sectionShellClass: string;
	ewrpFieldsetShellClass: string;
	ewrpTopicHeroClass: string;
	ewrpOptionalFieldBlockClass: string;
	ewrpFieldsetOptionalShellClass: string;
	stickyContextBarClass: string;
};

export function useEwrpGenerateTabDerived(
	input: EwrpGenerateTabDerivedInput
): EwrpGenerateTabDerived {
	const { t } = useTranslation('ewrp');
	const {
		topic,
		title,
		jobId,
		status,
		numSlides,
		presentationTheme,
		sourceDocumentLoading,
		shellPanel,
		shellFrame,
		perSlideCredits,
	} = input;

	const generateWorkspaceLabel = useMemo(
		() =>
			resolveEwrpGenerateWorkspaceLabel({
				formTopic: topic,
				formTitle: title,
				statusTitle: status?.title,
				statusTopic: status?.topic,
			}),
		[topic, title, status?.title, status?.topic]
	);
	const stickyHeadline = generateWorkspaceLabel || t('sticky.draftUntitled');
	const statusMetaSlideCount = useMemo(
		() => resolveEwrpStatusSlideCount(status),
		[status]
	);
	const stickySlidesMismatch = ewrpStickySlidesMismatch({
		hasActiveJob: Boolean(jobId),
		formNumSlides: numSlides,
		jobSlideCount: statusMetaSlideCount,
	});
	const stickyFormThemeLabel = useMemo(() => {
		const themeId = presentationTheme.trim();
		if (!themeId || themeId === 'classic') return null;
		if ((EWRP_PRESENTATION_THEME_IDS as readonly string[]).includes(themeId)) {
			return t(`themes.${themeId as EwrpPresentationThemeId}.title`);
		}
		return themeId;
	}, [presentationTheme, t]);
	const stickyFormThemeDisplayLabel = useMemo(() => {
		const themeId = (presentationTheme.trim() ||
			'classic') as EwrpPresentationThemeId;
		if ((EWRP_PRESENTATION_THEME_IDS as readonly string[]).includes(themeId)) {
			return t(`themes.${themeId}.title`);
		}
		return themeId;
	}, [presentationTheme, t]);
	const stickyJobThemeLabel = useMemo(() => {
		if (!status) return null;
		const themeId = ((status.presentation_theme || 'classic').trim() ||
			'classic') as EwrpPresentationThemeId;
		if ((EWRP_PRESENTATION_THEME_IDS as readonly string[]).includes(themeId)) {
			return t(`themes.${themeId}.title`);
		}
		return themeId;
	}, [status, t]);
	const stickyThemeMismatch = ewrpStickyThemeMismatch({
		hasActiveJob: Boolean(jobId && status),
		formTheme: presentationTheme,
		jobTheme: status?.presentation_theme,
	});
	const stickyFormSourcePending = sourceDocumentLoading;
	const presentationEnergyDetail = useMemo(() => {
		const total = numSlides * perSlideCredits;
		const legacyTotal = numSlides * EWRP_LEGACY_CREDITS_PER_SLIDE;
		return (
			<>
				<span className="sr-only" id="ewrp-energy-hint">
					{t('energy.srWasNow', { legacy: legacyTotal, total })}
				</span>
				<span className="line-through tabular-nums opacity-70" aria-hidden>
					{legacyTotal}
				</span>{' '}
				<span className="tabular-nums font-medium">
					{t('energy.totalUnit', { total })}
				</span>
				{' · '}
				<span className="tabular-nums">
					{t('energy.perSlideBreakdown', {
						slides: numSlides,
						per: perSlideCredits,
					})}
				</span>
			</>
		);
	}, [numSlides, perSlideCredits, t]);

	const sectionShellClass = useMemo(
		() =>
			cn(
				shellPanel,
				'space-y-4 ring-1 ring-black/4 motion-safe:transition-[box-shadow,ring-color] motion-safe:duration-300 hover:ring-black/[0.07]'
			),
		[shellPanel]
	);
	const ewrpFieldsetShellClass = useMemo(
		() =>
			cn(
				sectionShellClass,
				'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.42)] pl-3 sm:pl-4',
				'focus-within:shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.1)] motion-safe:transition-shadow motion-safe:duration-200'
			),
		[sectionShellClass]
	);
	const ewrpTopicHeroClass = useMemo(
		() =>
			cn(
				'rounded-2xl border-2 border-[rgb(var(--desktop-accent-rgb)/0.48)]',
				'bg-[linear-gradient(165deg,rgb(var(--desktop-accent-rgb)/0.14)_0%,rgb(var(--desktop-accent-rgb)/0.05)_100%)]',
				'p-4 shadow-[0_10px_40px_-18px_rgb(var(--desktop-accent-rgb)/0.42)] sm:p-5',
				'ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.16)]'
			),
		[]
	);
	const ewrpOptionalFieldBlockClass = useMemo(
		() =>
			cn(
				'rounded-xl border border-dashed border-(--desktop-border-subtle)/55',
				'bg-(--desktop-surface-soft)/15 px-4 py-4 sm:px-5 sm:py-4'
			),
		[]
	);
	const ewrpFieldsetOptionalShellClass = useMemo(
		() =>
			cn(
				shellPanel,
				'space-y-4 rounded-2xl border border-(--desktop-border-subtle)/45',
				'bg-(--desktop-surface-soft)/10 p-4 ring-1 ring-black/[0.035] sm:p-5'
			),
		[shellPanel]
	);
	const stickyContextBarClass = useMemo(
		() =>
			cn(
				getDesktopShellContentPanelClassName(shellFrame),
				'sticky top-0 z-20 rounded-xl border border-(--desktop-border-subtle)/70 border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.38)] py-3 pl-4 pr-3.5 shadow-(--desktop-shadow-soft) ring-1 ring-inset ring-white/[0.05] backdrop-blur-md motion-safe:transition-[box-shadow,ring-color] motion-safe:duration-300'
			),
		[shellFrame]
	);

	return {
		stickyHeadline,
		statusMetaSlideCount,
		stickySlidesMismatch,
		stickyFormThemeLabel,
		stickyFormThemeDisplayLabel,
		stickyJobThemeLabel,
		stickyThemeMismatch,
		stickyFormSourcePending,
		presentationEnergyDetail,
		sectionShellClass,
		ewrpFieldsetShellClass,
		ewrpTopicHeroClass,
		ewrpOptionalFieldBlockClass,
		ewrpFieldsetOptionalShellClass,
		stickyContextBarClass,
	};
}
