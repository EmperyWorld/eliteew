/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bottom AI output panels for brand, learning, and listing lanes below the active workspace scroll.
 *
 * Invariants:
 * - Renders nothing when the active view lane has no generated text.
 * - Status-only progress/notice messages must stay local to the initiating surface, not become a bottom output panel.
 * - Listing output appears only on the properties view (objects workspace).
 *
 * Related:
 * - ProfessionalWorldsWorkspaceContext.tsx
 */

import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { useProfessionalWorldsWorkspace } from '../ProfessionalWorldsWorkspaceContext';
import { ProfessionalWorldsAiOutputPanel } from '../layout';

function hasGeneratedText(lane: { text: string }): boolean {
	return lane.text.trim().length > 0;
}

export function ProfessionalWorldsAiOutputRail() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { activeView, brandStream, copyLane, learningStream, listingStream } =
		useProfessionalWorldsWorkspace();

	return (
		<div className="grid gap-0">
			{activeView === 'brand' && hasGeneratedText(brandStream) && (
				<ProfessionalWorldsAiOutputPanel
					copyLabel={t('actions.copy')}
					generationText={brandStream.text}
					onCopy={() => void copyLane('brand')}
					outputLabel={t('ai.output')}
					streamStatus={brandStream.status}
					waitingLabel={t('ai.waiting')}
				/>
			)}
			{activeView === 'learning' && hasGeneratedText(learningStream) && (
				<ProfessionalWorldsAiOutputPanel
					copyLabel={t('actions.copy')}
					generationText={learningStream.text}
					onCopy={() => void copyLane('learning')}
					outputLabel={t('ai.output')}
					streamStatus={learningStream.status}
					waitingLabel={t('ai.waiting')}
				/>
			)}
			{activeView === 'properties' && hasGeneratedText(listingStream) && (
				<ProfessionalWorldsAiOutputPanel
					copyLabel={t('actions.copy')}
					generationText={listingStream.text}
					onCopy={() => void copyLane('listing')}
					outputLabel={t('ai.output')}
					streamStatus={listingStream.status}
					waitingLabel={t('ai.waiting')}
				/>
			)}
		</div>
	);
}
