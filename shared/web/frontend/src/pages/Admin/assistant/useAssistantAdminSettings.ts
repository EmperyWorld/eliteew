/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query hook for assistant admin settings load/save and draft state.
 *
 * Invariants:
 * - Draft fields sync from server settings when query data changes.
 *
 * Related:
 * - pages/Admin/assistant/AssistantSettingsPanel.tsx
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
	getAssistantSettings,
	patchAssistantSettings,
	type AssistantSettings,
} from '../../Desktop/services/productDesktopApi';

export function useAssistantAdminSettings() {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'assistantAdmin' });
	const qc = useQueryClient();

	const settingsQuery = useQuery({
		queryKey: ['admin', 'assistant', 'settings'],
		queryFn: getAssistantSettings,
	});

	const [llamaModelDraft, setLlamaModelDraft] = React.useState('');
	const [extraPromptDraft, setExtraPromptDraft] = React.useState('');
	const [ragEnabledDraft, setRagEnabledDraft] = React.useState(true);
	const [ragTopKDraft, setRagTopKDraft] = React.useState(8);

	React.useEffect(() => {
		const s: AssistantSettings | undefined = settingsQuery.data;
		if (!s) return;
		setLlamaModelDraft(s.llama_model ?? '');
		setExtraPromptDraft(s.extra_system_prompt ?? '');
		setRagEnabledDraft(s.rag_enabled);
		setRagTopKDraft(s.rag_top_k);
	}, [settingsQuery.data]);

	const patchSettingsMut = useMutation({
		mutationFn: patchAssistantSettings,
		onSuccess: async () => {
			toast.success(t('toastSettingsSaved'));
			await qc.invalidateQueries({
				queryKey: ['admin', 'assistant', 'settings'],
			});
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const saveSettings = React.useCallback(() => {
		const rk = ragTopKDraft;
		patchSettingsMut.mutate({
			llama_model: llamaModelDraft.trim() || null,
			extra_system_prompt: extraPromptDraft.trim() || null,
			rag_enabled: ragEnabledDraft,
			rag_top_k: Number.isFinite(rk) ? rk : 8,
		});
	}, [
		extraPromptDraft,
		llamaModelDraft,
		patchSettingsMut,
		ragEnabledDraft,
		ragTopKDraft,
	]);

	return {
		settings: settingsQuery.data,
		llamaModelDraft,
		setLlamaModelDraft,
		extraPromptDraft,
		setExtraPromptDraft,
		ragEnabledDraft,
		setRagEnabledDraft,
		ragTopKDraft,
		setRagTopKDraft,
		saveSettings,
		isSaving: patchSettingsMut.isPending,
	};
}
