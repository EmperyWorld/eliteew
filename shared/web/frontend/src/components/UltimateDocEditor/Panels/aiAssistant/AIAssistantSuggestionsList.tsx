/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tracked suggestion list UI for AIAssistantPanel chat region.
 *
 * Related:
 * - useAIAssistantSuggestions.ts
 */

import type { TFunction } from 'i18next';
import {
	DesktopAppButton,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type { AIAssistantSuggestion } from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantTypes';

type AIAssistantSuggestionsListProps = {
	t: TFunction<'docEditorPanels'>;
	suggestions: AIAssistantSuggestion[];
	onAccept: (id: string, text: string) => void;
	onReject: (id: string) => void;
};

export function AIAssistantSuggestionsList({
	t,
	suggestions,
	onAccept,
	onReject,
}: AIAssistantSuggestionsListProps) {
	if (suggestions.length === 0) {
		return null;
	}

	return (
		<DesktopAppPanel className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2">
			<p className="text-[11px] font-medium text-(--desktop-text-secondary)">
				{t('ai.suggestions.heading', {
					pending: suggestions.filter((item) => item.status === 'pending')
						.length,
				})}
			</p>
			<div className="mt-2 space-y-2">
				{suggestions.map((item) => (
					<div
						key={item.id}
						className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-app) p-2"
					>
						<div className="line-clamp-3 text-[11px] text-(--desktop-text-primary)">
							{item.text}
						</div>
						<div className="mt-1 flex items-center justify-between gap-2">
							<span className="text-[10px] text-(--desktop-text-dim)">
								{item.status === 'pending'
									? t('ai.suggestions.statusPending')
									: item.status === 'accepted'
										? t('ai.suggestions.statusAccepted')
										: t('ai.suggestions.statusRejected')}
							</span>
							{item.status === 'pending' ? (
								<div className="flex gap-1.5">
									<DesktopAppButton
										onClick={() => void onAccept(item.id, item.text)}
										variant="accent"
										size="sm"
										className="text-[10px]"
									>
										{t('ai.suggestions.accept')}
									</DesktopAppButton>
									<DesktopAppButton
										onClick={() => onReject(item.id)}
										variant="neutral"
										size="sm"
										className="text-[10px]"
									>
										{t('ai.suggestions.reject')}
									</DesktopAppButton>
								</div>
							) : null}
						</div>
					</div>
				))}
			</div>
		</DesktopAppPanel>
	);
}
