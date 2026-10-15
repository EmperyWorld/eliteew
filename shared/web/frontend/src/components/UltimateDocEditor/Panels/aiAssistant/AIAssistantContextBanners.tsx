/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * File-manager context banner and stream-recovery banner for AIAssistantPanel.
 *
 * Related:
 * - useAIAssistantChat.ts
 */

import type { TFunction } from 'i18next';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import type { AiFileManagerContext } from '@/components/UltimateDocEditor/types/editor.types';
import type { DocAiStreamDraft } from '@/components/UltimateDocEditor/utils/docAiStreamRecovery';

type AIAssistantContextBannersProps = {
	t: TFunction<'docEditorPanels'>;
	fileManagerDocumentContext?: AiFileManagerContext | null;
	onClearFileManagerDocumentContext?: () => void;
	recoveryDraft: DocAiStreamDraft | null;
	onRestoreDraft: () => void;
	onDismissRecovery: () => void;
};

export function AIAssistantContextBanners({
	t,
	fileManagerDocumentContext,
	onClearFileManagerDocumentContext,
	recoveryDraft,
	onRestoreDraft,
	onDismissRecovery,
}: AIAssistantContextBannersProps) {
	return (
		<>
			{fileManagerDocumentContext && onClearFileManagerDocumentContext ? (
				<div className="shrink-0 border-b border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
					<div className="flex items-start justify-between gap-2">
						<p className="min-w-0 text-[11px] leading-snug text-(--desktop-text-secondary)">
							{t('ai.fileManagerContext.banner', {
								title: fileManagerDocumentContext.title,
							})}
						</p>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="shrink-0 text-[11px]"
							onClick={onClearFileManagerDocumentContext}
						>
							{t('ai.fileManagerContext.clear')}
						</DesktopAppButton>
					</div>
				</div>
			) : null}

			{recoveryDraft ? (
				<div className="shrink-0 border-b border-amber-500/25 bg-amber-500/10 px-3 py-2">
					<p className="mb-2 text-[11px] leading-snug text-(--desktop-text-secondary)">
						{t('ai.recovery.banner')}
					</p>
					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							onClick={onRestoreDraft}
						>
							<ArrowUturnLeftIcon width={14} height={14} />
							{t('ai.recovery.restore')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={onDismissRecovery}
						>
							{t('ai.recovery.dismiss')}
						</DesktopAppButton>
					</div>
				</div>
			) : null}
		</>
	);
}
