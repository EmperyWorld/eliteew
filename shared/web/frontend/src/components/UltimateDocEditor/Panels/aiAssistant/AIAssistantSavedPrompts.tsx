/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsible saved-prompts library for AIAssistantPanel.
 *
 * Related:
 * - useAIAssistantCompose.ts
 */

import type { TFunction } from 'i18next';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

type SavedPrompt = {
	id: string;
	name: string;
	prompt: string;
};

type AIAssistantSavedPromptsProps = {
	t: TFunction<'docEditorPanels'>;
	footerStripClass: string;
	savedPrompts: SavedPrompt[];
	onUsePrompt: (promptText: string) => void;
};

export function AIAssistantSavedPrompts({
	t,
	footerStripClass,
	savedPrompts,
	onUsePrompt,
}: AIAssistantSavedPromptsProps) {
	if (savedPrompts.length === 0) {
		return null;
	}

	return (
		<details className={cn('shrink-0', footerStripClass)}>
			<summary className="flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover)">
				<BookOpenIcon
					width={12}
					height={12}
					className="text-[rgb(var(--desktop-accent-rgb)/0.85)]"
				/>
				<span>
					{t('ai.savedPrompts.summary', { count: savedPrompts.length })}
				</span>
			</summary>
			<div className="max-h-24 overflow-y-auto px-3 pb-2 space-y-0.5">
				{savedPrompts.map((p) => (
					<button
						type="button"
						key={p.id}
						onClick={() => onUsePrompt(p.prompt)}
						className="w-full rounded py-1 text-left text-[11px] text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)"
					>
						{p.name}
					</button>
				))}
			</div>
		</details>
	);
}
