/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public props contract for the EWRP Generate-tab presentational panel.
 *
 * Invariants:
 * - Props-only — no second store; values/handlers arrive from `EWRPGeneratorMain`.
 * - Re-exported via facade `EwrpGenerateTabPanel.tsx`.
 *
 * Related:
 * - `EwrpGenerateTabPanel.tsx`, `EWRPGeneratorMain.tsx`
 * - `documentation/product/EWRP-EDITOR.md`
 */

import type { FormEvent } from 'react';
import type { DesktopWindowStyle } from '@/types/profile';
import type { ContentItem } from '../EwrpGeneratorChunks';
import type { EwrpWebSearchQuality } from '../ewrpWebSearchQuality';
import type { EwrpStatusResponse } from '@/services/ewrpApi';

export type EwrpGenerateTabPanelProps = {
	secondaryBtnClass: string;
	primaryBtnClass: string;
	shellField: string;
	shellSelectClass: string;
	shellPanel: string;
	shellFrame: DesktopWindowStyle;
	historyJobsCount: number;
	onOpenHistory: () => void;
	jobId: string | null;
	status: EwrpStatusResponse | null;
	activeJobBannerHeadline: string;
	onOpenPresentationsStatus: () => void;
	topic: string;
	onTopicChange: (value: string) => void;
	title: string;
	onTitleChange: (value: string) => void;
	statusLiveText: string;
	numSlides: number;
	onNumSlidesChange: (value: number) => void;
	sourceDocument: ContentItem | null;
	onSourceDocumentClear: () => void;
	onSubmit: (e: FormEvent) => void;
	submitting: boolean;
	formLocked: boolean;
	presentationTheme: string;
	onPresentationThemeChange: (value: string) => void;
	firstSlideStyle: string;
	onFirstSlideStyleChange: (value: string) => void;
	webSearchQuality: EwrpWebSearchQuality;
	onWebSearchQualityChange: (value: EwrpWebSearchQuality) => void;
	extraContext: string;
	onExtraContextChange: (value: string) => void;
	sourceDocumentLoading: boolean;
	onOpenDocPicker: () => void;
	insufficientEnergy: boolean;
	presentationEnergyCost: number;
	ugsAvailableCredits: number | null;
	perSlideCredits: number;
};
