/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * AI assistant panel header strip (title + close).
 *
 * Invariants:
 * - Header accent uses desktop accent tokens (no purple wash).
 *
 * Related:
 * - AIAssistantPanel.tsx, aiAssistantPanelChrome.ts
 */

import type { TFunction } from 'i18next';
import { SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DOC_EDITOR_AI_HEADER_ICON_CLASS,
	DOC_EDITOR_AI_HEADER_PAD_CLASS,
	DOC_EDITOR_AI_SUBTITLE_CLASS,
	DOC_EDITOR_AI_TITLE_CLASS,
} from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantPanelChrome';

type AIAssistantHeaderProps = {
	t: TFunction<'docEditorPanels'>;
	headerStripClass: string;
	onClose: () => void;
};

export function AIAssistantHeader({
	t,
	headerStripClass,
	onClose,
}: AIAssistantHeaderProps) {
	return (
		<div className={cn(DOC_EDITOR_AI_HEADER_PAD_CLASS, headerStripClass)}>
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<div className={DOC_EDITOR_AI_HEADER_ICON_CLASS}>
						<SparklesIcon width={16} height={16} aria-hidden />
					</div>
					<div className="min-w-0">
						<h3
							id="ai-assistant-panel-title"
							className={DOC_EDITOR_AI_TITLE_CLASS}
						>
							{t('ai.title')}
						</h3>
						<p className={DOC_EDITOR_AI_SUBTITLE_CLASS}>{t('ai.subtitle')}</p>
					</div>
				</div>
				<DesktopAppButton
					type="button"
					onClick={onClose}
					variant="ghost"
					size="icon"
					title={t('ai.close')}
					aria-label={t('ai.close')}
					className="min-h-11 min-w-11"
				>
					<XMarkIcon
						width={18}
						height={18}
						className="text-(--desktop-text-muted)"
					/>
				</DesktopAppButton>
			</div>
		</div>
	);
}
