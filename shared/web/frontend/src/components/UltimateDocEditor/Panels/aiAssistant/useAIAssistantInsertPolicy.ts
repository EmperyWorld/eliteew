/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pre-insert policy guard and insert/replace handlers for AI panel output.
 *
 * Invariants:
 * - Insert/replace always runs pre-insert-check before mutating the document.
 *
 * Related:
 * - useAIAssistantCompose.ts, API_PATHS.DOC_EDITOR
 */

import type { TFunction } from 'i18next';
import { api } from '@/services/api/client';
import { API_PATHS } from '@/services/api/config';
import type { AIAssistantContextScope } from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantTypes';

type UseAIAssistantInsertPolicyArgs = {
	t: TFunction<'docEditorPanels'>;
	contextScope: AIAssistantContextScope;
	effectiveDocumentIdForAi: string | undefined;
	onInsert: (text: string) => void;
	onReplace: (text: string) => void;
	clearChatHistory: () => void;
	setStreamingText: (text: string) => void;
	showError: (title: string, body: string) => void;
};

export function useAIAssistantInsertPolicy({
	t,
	contextScope,
	effectiveDocumentIdForAi,
	onInsert,
	onReplace,
	clearChatHistory,
	setStreamingText,
	showError,
}: UseAIAssistantInsertPolicyArgs) {
	const runPreInsertGuard = async (text: string): Promise<boolean> => {
		try {
			const response = await api.post<{
				allowed: boolean;
				warnings?: string[];
			}>(`${API_PATHS.DOC_EDITOR}/ai/pre-insert-check`, {
				text,
				context_scope: contextScope,
				document_id: effectiveDocumentIdForAi ?? null,
			});
			if (!response.allowed) {
				showError(
					t('ai.policy.blockedTitle'),
					(response.warnings ?? []).join(', ') || t('ai.policy.blockedBody')
				);
				return false;
			}
			if (response.warnings && response.warnings.length > 0) {
				showError(
					t('ai.policy.reviewTitle'),
					t('ai.policy.reviewBody', {
						warnings: response.warnings.join(', '),
					})
				);
			}
			return true;
		} catch (error) {
			showError(
				t('ai.policy.unavailableTitle'),
				error instanceof Error ? error.message : t('ai.policy.unavailableBody')
			);
			return false;
		}
	};

	const handleInsert = async (text: string): Promise<void> => {
		const allowed = await runPreInsertGuard(text);
		if (!allowed) {
			return;
		}
		onInsert(text);
		clearChatHistory();
		setStreamingText('');
	};

	const handleReplace = async (text: string): Promise<void> => {
		const allowed = await runPreInsertGuard(text);
		if (!allowed) {
			return;
		}
		onReplace(text);
		clearChatHistory();
		setStreamingText('');
	};

	return {
		handleInsert,
		handleReplace,
	};
}
