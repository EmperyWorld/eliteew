/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Roadmap / active plan view inside companion output surface.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx plan strip
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

type Props = {
	onBackToChat: () => void;
	planContent: ReactNode;
};

export function CompanionOutputRoadmapMode({
	onBackToChat,
	planContent,
}: Props) {
	const { t } = useTranslation('marketing');

	return (
		<div
			className="flex flex-col gap-3"
			data-testid="ewa-companion-output-roadmap"
		>
			<div className="flex items-center justify-between gap-2">
				<p className="text-[13px] font-semibold text-(--desktop-text-primary)">
					{t('ewaCompanion.outputSurfaceRoadmapTitle')}
				</p>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					onClick={onBackToChat}
				>
					{t('ewaCompanion.outputSurfaceBackToChat')}
				</DesktopAppButton>
			</div>
			{planContent}
		</div>
	);
}
