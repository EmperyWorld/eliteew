/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Modal to name and persist the current composer prompt.
 *
 * Related:
 * - useAIAssistantCompose.ts
 */

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { InputAdvanced } from '@/components/ui/InputAdvanced';
import { ModalAdvanced } from '@/components/ui/ModalAdvanced';

type AIAssistantSavePromptModalProps = {
	t: TFunction<'docEditorPanels'>;
	isOpen: boolean;
	promptName: string;
	setPromptName: Dispatch<SetStateAction<string>>;
	inputRef: RefObject<HTMLInputElement | null>;
	onClose: () => void;
	onConfirm: () => void;
};

export function AIAssistantSavePromptModal({
	t,
	isOpen,
	promptName,
	setPromptName,
	inputRef,
	onClose,
	onConfirm,
}: AIAssistantSavePromptModalProps) {
	return (
		<ModalAdvanced
			isOpen={isOpen}
			onClose={onClose}
			title={t('ai.savePrompt.title')}
			size="sm"
			variant="desktop"
			closeOnEscape
		>
			<div className="space-y-4">
				<InputAdvanced
					ref={inputRef}
					label={t('ai.savePrompt.nameLabel')}
					value={promptName}
					onChange={(e) => setPromptName(e.target.value)}
					placeholder={t('ai.savePrompt.namePlaceholder')}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && promptName.trim()) {
							void onConfirm();
						}
					}}
				/>
				<div className="flex flex-wrap gap-2 justify-end">
					<DesktopAppButton
						onClick={onClose}
						variant="neutral"
						className="min-h-11 px-4"
					>
						{t('ai.savePrompt.cancel')}
					</DesktopAppButton>
					<DesktopAppButton
						onClick={() => void onConfirm()}
						disabled={!promptName.trim()}
						variant="accent"
						className="min-h-11 px-4"
					>
						{t('ai.savePrompt.confirm')}
					</DesktopAppButton>
				</div>
			</div>
		</ModalAdvanced>
	);
}
