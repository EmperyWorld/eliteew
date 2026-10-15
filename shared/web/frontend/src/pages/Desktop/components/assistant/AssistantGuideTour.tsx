/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guided tour modal wiring for Assistant (Справочник): steps, audio, desktop title-bar opener.
 *
 * Invariants:
 * - Step prep opens FAQ panel or shortcuts when spotlight targets need them visible.
 *
 * Related:
 * - pages/Desktop/components/assistantGuideConstants.ts
 * - pages/Desktop/components/AssistantApp.tsx
 */
import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import type { TFunction } from 'i18next';
import * as React from 'react';
import {
	ASSISTANT_GUIDE_AUDIO_LS_KEY,
	ASSISTANT_GUIDE_ROOT_ID,
	ASSISTANT_GUIDE_STEP_DEFS,
	ASSISTANT_GUIDE_TOUR_FOLDER,
} from '../assistantGuideConstants';

export type AssistantGuideTourProps = {
	t: TFunction<'desktopUi', 'assistant'>;
	/** When false, title-bar guide opener is not registered (embedded handbook). */
	enabled?: boolean;
	faqMobileOpen: boolean;
	shortcutsOpen: boolean;
	onFaqMobileOpenChange: (open: boolean) => void;
	onShortcutsOpenChange: (open: boolean) => void;
};

export function AssistantGuideTour({
	t,
	enabled = true,
	faqMobileOpen,
	shortcutsOpen,
	onFaqMobileOpenChange,
	onShortcutsOpenChange,
}: AssistantGuideTourProps): React.ReactElement {
	const guideLabels = React.useMemo(
		() => guideTourLabelsFromI18n(t, 'guide'),
		[t]
	);
	const guideSteps = useBuiltGuideSteps(
		t,
		'guide.steps',
		ASSISTANT_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = React.useState(false);
	const openGuideTour = React.useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour, { enabled });

	const prepareGuideStep = React.useCallback(
		(stepId: string) => {
			if (stepId === 'faq-search' || stepId === 'faq-list') {
				onFaqMobileOpenChange(true);
			}
			if (stepId === 'shortcuts') {
				onShortcutsOpenChange(true);
			}
		},
		[onFaqMobileOpenChange, onShortcutsOpenChange]
	);

	return (
		<SpotlightGuideModal
			open={guideOpen}
			onClose={() => setGuideOpen(false)}
			rootId={ASSISTANT_GUIDE_ROOT_ID}
			steps={guideSteps}
			audioLocalStorageKey={ASSISTANT_GUIDE_AUDIO_LS_KEY}
			tourAudioFolder={ASSISTANT_GUIDE_TOUR_FOLDER}
			labels={guideLabels}
			onPrepareStep={prepareGuideStep}
			spotlightLayoutKey={`${guideOpen}-${faqMobileOpen}-${shortcutsOpen}`}
			dialogTitleId="assistant-guide-title"
		/>
	);
}
